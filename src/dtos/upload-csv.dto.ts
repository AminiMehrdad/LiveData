
import { ApiProperty } from '@nestjs/swagger';

export class UploadCsvDto {

  @ApiProperty({
    description: 'Well name identifier',
    example: 'Well-Alpha-01',
  })
  wellName: string;

  @ApiProperty({
    description: 'CSV file containing well data',
    type: 'string',
    format: 'binary',
  })
  file: any;
}
