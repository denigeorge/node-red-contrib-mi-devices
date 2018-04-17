import {Red, Node, NodeProperties} from "node-red";
import {Constants} from "../constants";
import {GatewayServer} from "../../devices/gateway/GatewayServer";
import {Gateway} from "../../devices/gateway/Gateway";
import {GatewaySubdevice} from "../../devices/gateway/GatewaySubdevice";
import {isString} from "util";

export interface IGatewayConfiguratorNode extends Node {
    ip: string;
    sid: number;
    gateway: Gateway;

    on(event: "gateway-online", listener: (sid: string) => void): any;

    on(event: "gateway-offline", listener: (sid: string) => void): any;

    on(event: "subdevice-update", listener: (subdevice: GatewaySubdevice) => void): any;
}

interface GatewayConfiguratorSubDevice {
    name: string;
    internalModel: string;
}

export default (RED: Red) => {
    class GatewayConfigurator {
        sid: string;
        key: string;
        deviceList: { [sid: string]: GatewayConfiguratorSubDevice };
        _gateway: Gateway;

        constructor(props: NodeProperties) {
            RED.nodes.createNode(<any> this, props);
            let {sid, key, deviceList} = <any> props;
            this.sid = sid;
            this.key = key;
            this.deviceList = deviceList;
            let server = GatewayServer.getInstance();
            if (this.sid) {
                this.setGateway();
            }

            server.on('gateway-online', (sid: string) => {
                if (sid === this.sid) {
                    this.setGateway();
                    (<any> this).emit('gateway-online');
                }
            });

            server.on('gateway-offline', (sid: string) => {
                if (sid === this.sid) {
                    this._gateway = null;
                    (<any> this).emit('gateway-offline');
                }
            });
        }

        protected setGateway() {
            this._gateway = GatewayServer.getInstance().getGateway(this.sid);
            if (this._gateway) {
                this._gateway.password = this.key;
                this._gateway.on("subdevice-values-updated", (sidOrMessage: string|any) => {
                    let sid = sidOrMessage.sid || sidOrMessage;
                    let subdevice = this._gateway.getSubdevice(sid);
                    if (subdevice) {
                        (sidOrMessage.data ? Object.keys(sidOrMessage.data) : []).forEach((key:string) => {
                           subdevice[key] = sidOrMessage.data[key];
                        });
                        (<any> this).emit('subdevice-update', subdevice);
                    }
                });
            }
        }

        get gateway(): Gateway {
            return this._gateway;
        }
    }

    RED.nodes.registerType(`${Constants.NODES_PREFIX}-gateway configurator`, <any> GatewayConfigurator, {
        settings: {
            miDevicesGatewayConfiguratorDiscoveredGateways: {
                value: GatewayServer.getInstance().gateways,
                exportable: true
            }
        }
    });
};