export class ScryfallQueryError extends Error {
  readonly code: 'syntax' | 'unsupported';

  constructor(message: string, code: 'syntax' | 'unsupported' = 'syntax') {
    super(message);
    this.name = 'ScryfallQueryError';
    this.code = code;
  }
}
