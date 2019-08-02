import * as React from 'react';
import { getDomainInfo, getDomains, findDomain } from '../util';
import { DomainInfo } from '../typings/domain';
import './Popup.scss';

interface AppProps { }

interface AppState {
    value: string;
    domains: DomainInfo[];
    error?: string;
}

export default class Popup extends React.Component<AppProps, AppState> {
    state: AppState = { value: '', domains: [] }
    constructor(props: AppProps, state: AppState) {
        super(props, state);
    }

    componentDidMount() {
        getDomains((domains) => {
            this.setState({ domains });
        })
    }

    handleCurrentUrl = (subDomain: boolean) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            this.save(tabs[0].url, subDomain);
        });
    }

    save(domain: string, subDomain?: boolean, callback?: () => void) {
        var domainInfo = getDomainInfo(domain);
        getDomains((domains) => {
            if (!domains) domains = [];
            if (findDomain(domains, domainInfo, subDomain ? 'sub' : undefined)) {
                this.setError('domain already added!');
                return
            }
            domains.push({ n: subDomain ? domainInfo.domainWithSub : domainInfo.domain, v: true })
            this.saveDomains(domains, callback);
        })
    }

    saveDomains(domains: DomainInfo[], callback?: () => void) {
        chrome.storage.sync.set({ 'domainList': domains }, () => {
            this.setState({ domains: [...domains] })
            chrome.runtime.sendMessage({ domainListChanged: true });
            if (callback) callback();
        });
    }

    setError(error: string) {
        this.setState({ error });
        setTimeout(() => {
            this.setState({ error: '' })
        }, 2000);
    }

    handleDelete = (domain: string) => {
        getDomains((domains) => {
            domains = domains.filter(x => x.n !== domain);
            this.saveDomains(domains);
        });
    }

    handlePrivateWindowsCheckBox = (event) => (domain: string) => {
        const checked = (event.target as any).checked;
        getDomains((domains) => {
            const d = domains.find(x => x.n === domain);
            d.p = checked;
            this.saveDomains(domains);
        });
    }
    handleVPNCheckBox = (event) => (domain: string) => {
        const checked = (event.target as any).checked;
        getDomains((domains) => {
            const d = domains.find(x => x.n === domain);
            d.v = checked;
            this.saveDomains(domains);
        });
    }

    handleInput = (e) => {
        this.setState({ value: e.target.value });
    }

    handleInputSave = () => {
        const { value } = this.state;
        if (!value) {
            this.setError('No input value!');
            return;
        }
        this.save(value, false, () => {
            this.setState({ value: '' });
        });
    }

    render() {
        const { domains, error } = this.state;

        return (
            <div className="popupContainer">
                <p>Domain List</p>
                <small className="decryption">The domain names in the list must run with VPN only</small>
                <hr />
                <div className="list">
                    <div className="list-item list-title">
                        <span>Name</span>
                        <span className="item-tools">
                            <span title="private">PRV</span>
                            <span title="VPN connection">VPN</span>
                            <span title="delete" >Del</span>
                        </span>
                    </div>
                    {domains && domains.map((domain) =>
                        <div className="list-item" key={domain.n}>
                            <span>{domain.n}</span>
                            <span className="item-tools">
                                <span className="cb-wrp">
                                    <input onChange={(e) => this.handlePrivateWindowsCheckBox(e)(domain.n)} checked={domain.p || false} title="open in private window" type="checkbox" />
                                </span>
                                <span className="cb-wrp">
                                    <input onChange={(e) => this.handleVPNCheckBox(e)(domain.n)} checked={domain.v || false} title="must use vpn connection" type="checkbox" />
                                </span>
                                <span className="delete" onClick={() => this.handleDelete(domain.n)}>⌧</span>
                            </span>
                        </div>
                    )}
                    {
                        !domains && <div className="list-item">No data returned</div>
                    }
                </div>
                <div className="wrapper">
                    <input type="text" value={this.state.value} onChange={this.handleInput} />
                </div>
                <div className="wrapper">
                    <button onClick={this.handleInputSave}>Save</button>
                    <button onClick={() => this.handleCurrentUrl(false)}>Save current domain</button>
                    <button onClick={() => this.handleCurrentUrl(true)}>Save current domain with subdomain</button>

                </div>
                <div className="error">
                    {error}
                </div>
            </div>
        )
    }
}
