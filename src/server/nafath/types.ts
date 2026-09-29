export type NafathStatus = "WAITING" | "COMPLETED" | "REJECTED" | "EXPIRED" | "ERROR";

export interface NafathUser {
  nationalId: string;
  fullNameAr?: string;
  fullNameEn?: string;
}

export interface NafathInitiation {
  transId: string;
  random: string;
  expiresInSec: number;
}

export interface NafathStatusResult {
  status: NafathStatus;
  user?: NafathUser;
}

export interface NafathClient {
  initiate(nationalId: string, locale: string): Promise<NafathInitiation>;
  getStatus(args: {
    transId: string;
    random: string;
    nationalId: string;
  }): Promise<NafathStatusResult>;
}
