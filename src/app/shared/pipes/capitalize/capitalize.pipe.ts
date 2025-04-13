import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'capitalize'
})
export class CapitalizePipe implements PipeTransform {

  transform(value: string): string {
    if (!value) return '';
    return value.replace(/(?:^|\s|["'([{/.])+\S/g, match => match.toUpperCase());
  }
}
