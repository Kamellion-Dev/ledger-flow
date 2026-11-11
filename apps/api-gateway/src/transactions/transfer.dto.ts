import { Equals, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTransferDto {
  @IsString()
  @MinLength(1)
  sourceAccountId!: string;

  @IsString()
  @MinLength(1)
  destinationAccountId!: string;

  @IsInt()
  @Min(1)
  amountMinor!: number;

  @Equals('USD')
  currency!: 'USD';

  @IsString()
  @MinLength(1)
  @MaxLength(140)
  reference!: string;
}

export class ReverseTransferDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  reason!: string;
}
