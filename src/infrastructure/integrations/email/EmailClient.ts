import nodemailer from "nodemailer";
import { Env } from "../../config/env.js";

export class EmailClient {
  public async sendLeadNotification(subject: string, html: string, to: string): Promise<boolean> {
    if (!Env.smtpHost || !Env.smtpUser || !Env.smtpPass) {
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: Env.smtpHost,
      port: Env.smtpPort,
      secure: Env.smtpSecure,
      auth: {
        user: Env.smtpUser,
        pass: Env.smtpPass
      }
    });

    await transporter.sendMail({
      from: Env.smtpFrom,
      to,
      subject,
      html
    });

    return true;
  }
}
