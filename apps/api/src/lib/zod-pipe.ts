import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

export class ZodValidationPipe<S extends ZodType> implements PipeTransform<unknown, S['_output']> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): S['_output'] {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) {
      return result.data;
    }

    const message =
      result.error.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join('; ') || 'Validation failed';

    throw new BadRequestException(message);
  }
}

export const zodPipe = <S extends ZodType>(schema: S): ZodValidationPipe<S> =>
  new ZodValidationPipe(schema);
