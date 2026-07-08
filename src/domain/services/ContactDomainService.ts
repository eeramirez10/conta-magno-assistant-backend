export class ContactDomainService {
  public normalizePhone(raw: string): string {
    const value = raw.trim();
    const digits = value.replace(/\D/g, "");

    if (!digits) {
      return "+52";
    }

    // Prefix 00<country_code>... => +<country_code>...
    if (digits.startsWith("00") && digits.length > 2) {
      return `+${digits.slice(2)}`;
    }

    // Common legacy WhatsApp MX form 521XXXXXXXXXX -> 52XXXXXXXXXX
    if (digits.startsWith("521") && digits.length === 13) {
      return `+52${digits.slice(3)}`;
    }

    if (value.startsWith("+")) {
      return `+${digits}`;
    }

    // Local Mexico 10 digits
    if (digits.length === 10) {
      return `+52${digits}`;
    }

    // Already contains country code
    if (digits.length >= 11) {
      return `+${digits}`;
    }

    return `+52${digits}`;
  }

  public normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }
}
