import { getDomains, getDomainInfo, findDomain, getHostName } from "./util";
import { DomainInfo } from "./typings";
import * as memoize from "memoizee";

interface Validation {
  validToProceed: boolean;
  openPrivateWindows?: boolean;
}

let isVPNConnected = false;
var domains: DomainInfo[];
var isSocketConnected = false;
var incognitoTabs = {};
var redirectKey = "redirect__to=";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.domainListChanged) setDomains();
  return false;
});

chrome.storage.onChanged.addListener(function (changes, namespace) {
  setDomains();
});

function getValidation(url: string, vpnConnected: boolean): Validation {
  if (!domains || !url) return { validToProceed: true };

  const domainInfo = getDomainInfo(url);
  let domainInf = findDomain(domains, domainInfo, "domain");
  const subDomainInf = findDomain(domains, domainInfo, "sub");

  // if subdomain is available, it has priority over domain
  if (subDomainInf) domainInf = subDomainInf;

  if (!domainInf) return { validToProceed: true };

  if (domainInf.v && !vpnConnected) {
    return { validToProceed: false, openPrivateWindows: domainInf.p };
  }

  return { validToProceed: true, openPrivateWindows: domainInf.p };
}

let memoizedGetValidation = memoize(getValidation);

function setDomains() {
  ///
  console.log("load domain list");
  getDomains((d) => {
    domains = d;
    memoizedGetValidation = memoize(getValidation);
  });
}

setDomains();
connectToWebSocket();

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.incognito) incognitoTabs[tab.id] = true;

  const pendingUrl = tab.pendingUrl || tab.url;
  // to prevent loop
  if (pendingUrl.indexOf(redirectKey) !== -1) {
    const url = pendingUrl.split(redirectKey)[1];
    chrome.tabs.update(tab.id, { url: url });
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  if (incognitoTabs[tabId]) delete incognitoTabs[tabId];
});

function cancelRequest(requestDetails) {
  connectToWebSocket();
  try {
    const urlValidation = memoizedGetValidation(
      getHostName(requestDetails.url),
      isVPNConnected
    );

    const initiatorValidation = memoizedGetValidation(
      getHostName(requestDetails.initiator),
      isVPNConnected
    );

    if (
      urlValidation.validToProceed &&
      (!requestDetails.initiator ||
        requestDetails.url === requestDetails.initiator ||
        initiatorValidation.validToProceed)
    ) {
      if (
        urlValidation.openPrivateWindows &&
        requestDetails.type === "main_frame" &&
        !incognitoTabs[requestDetails.tabId]
      ) {
        chrome.windows.create({
          url: redirectKey + requestDetails.url,
          incognito: true,
        });
        return { cancel: true };
      }

      return { cancel: false };
    } else {
      return { cancel: true };
    }
  } catch (error) {
    console.error(error, requestDetails);
    return { cancel: true };
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  cancelRequest,
  { urls: ["<all_urls>"] },
  ["blocking"]
);

function connectToWebSocket() {
  if (!isSocketConnected) {
    try {
      const socket = new WebSocket("ws://localhost:8181");
      isSocketConnected = true;
      // Connection opened
      socket.onopen = () => {
        console.log("socket open");
        setTimeout(() => {
          socket.send("request_status");
        }, 500);
      };

      socket.onmessage = (event) => {
        switch (event.data) {
          case "0": // not connected
            isVPNConnected = false;
            chrome.browserAction.setIcon({ path: "../red16.png" });
            break;
          case "1":
          case "2": // 1: connected, 2: connected to target country
            isVPNConnected = true;
            chrome.browserAction.setIcon({ path: "../icon16.png" });
            break;
          default:
            isVPNConnected = false;
            chrome.browserAction.setIcon({ path: "../red16.png" });
            break;
        }
        console.log("Message from server ", event.data);
      };

      socket.onclose = () => {
        isSocketConnected = false;
        console.log("socket closed ");
      };
    } catch (error) {
      isSocketConnected = false;
    }
  }
}
