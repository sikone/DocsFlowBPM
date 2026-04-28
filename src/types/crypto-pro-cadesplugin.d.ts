declare module 'crypto-pro-cadesplugin' {
  interface CertValidPeriod {
    from: { ddmmyy: string; hhmmss: string };
    to: { ddmmyy: string; hhmmss: string };
  }

  interface Cert {
    thumbprint: string;
    subjectInfo: string;
    issuerInfo: string;
    validPeriod: { from: string; to: string };
    getSubjectInfo(): Record<string, string>;
    getInfo(key: 'subjectInfo' | 'issuerInfo'): Record<string, string>;
    friendlySubjectInfo(): Array<{ text: string; value: string }>;
    friendlyIssuerInfo(): Array<{ text: string; value: string }>;
    friendlyValidPeriod(): CertValidPeriod;
    isValid(): Promise<boolean>;
  }

  interface CadesPluginApi {
    getCertsList(): Promise<Cert[]>;
    signBase64(thumbprint: string, base64: string, detached?: boolean): Promise<string>;
    signXml(thumbprint: string, xml: string, type?: number): Promise<string>;
    currentCadesCert(thumbprint: string): Promise<unknown>;
    getCert(thumbprint: string): Promise<Cert>;
    about(): Promise<unknown>;
  }

  const cadespluginApi: () => Promise<CadesPluginApi>;
  export default cadespluginApi;
}
