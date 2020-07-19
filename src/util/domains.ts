import * as URI from "urijs";
import { DomainInfo } from "../typings";

interface DomainNameInfo {
  domain: string;
  domainWithSub?: string;
}

export const getDomainInfo = (url: string): DomainNameInfo => {
  var uri = new URI(url);
  var domain = uri.domain().replace("www.", "");
  const subdomain = uri.subdomain();
  var domainWithSub = subdomain
    ? (subdomain + "." + domain).replace("www.", "")
    : undefined;
  return {
    domain,
    domainWithSub,
  };
};

function validURL(str) {
  var pattern = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
    "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
    "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
    "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
    "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
      "(\\#[-a-z\\d_]*)?$",
    "i"
  ); // fragment locator
  return !!pattern.test(str);
}

export const getHostName = (url: string) => {
  if (!url) return url;
  const parsed = new URL(url);
  const newUrl = parsed.protocol + "//" + parsed.hostname;
  return newUrl;
};

export const getDomains = (callback: (domains: DomainInfo[]) => void) => {
  chrome.storage.sync.get("domainList", (result) => {
    callback(result["domainList"]);
  });
};

export const findDomain = (
  domains: DomainInfo[],
  domainInfo: DomainNameInfo,
  math?: "sub" | "domain"
) => {
  if (math === "sub")
    return domains.find(
      (x) => domainInfo.domainWithSub && x.n === domainInfo.domainWithSub
    );

  if (math === "domain") return domains.find((x) => x.n === domainInfo.domain);

  return domains.find(
    (x) =>
      x.n === domainInfo.domain ||
      (domainInfo.domainWithSub && x.n === domainInfo.domainWithSub)
  );
};
