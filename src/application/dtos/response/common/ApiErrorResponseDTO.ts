export class ApiErrorResponseDTO {
  constructor(
    public readonly ok: boolean,
    public readonly message: string
  ) {}

  public static fromMessage(message: string): ApiErrorResponseDTO {
    return new ApiErrorResponseDTO(false, message);
  }
}
