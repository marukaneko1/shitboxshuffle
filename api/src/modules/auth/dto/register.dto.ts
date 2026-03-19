import { Transform } from "class-transformer";
import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches, MinLength, MaxLength } from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  // SECURITY: Strong password requirements
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  })
  password!: string;

  // SECURITY: Sanitize display name - no HTML/script tags
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-zA-Z0-9\s\-_.]+$/, {
    message: 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and dots'
  })
  displayName!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'Username must be 3-20 characters and can only contain letters, numbers, and underscores'
  })
  username!: string;

  /** Empty string from `<input type="date">` must not reach @IsDateString (would fail validation). */
  @IsOptional()
  @Transform(({ value }) => (value === "" || value === null ? undefined : value))
  @IsDateString()
  dateOfBirth?: string;
}


