export class InquiryDomainService {
  public generateFolio(now: Date, seq: number): string {
    const y = now.getUTCFullYear();
    const m = `${now.getUTCMonth() + 1}`.padStart(2, "0");
    return `CM-${y}${m}-${`${seq}`.padStart(6, "0")}`;
  }
}
