export interface Electorate {
  id: string;
  nameTa: string;
  nameEn: string;
  district: string;
}
export interface Ward {
  id: string;
  electorateId: string;
  nameTa: string;
  nameEn: string;
}
