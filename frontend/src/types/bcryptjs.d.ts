declare module 'bcryptjs' {
  export function genSalt(rounds?: number): Promise<string>;
  export function hash(s: string, salt: string | number): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
  
  export namespace genSalt {
    export function sync(rounds?: number): string;
  }
  
  export namespace hash {
    export function sync(s: string, salt: string | number): string;
  }
  
  export namespace compare {
    export function sync(s: string, hash: string): boolean;
  }
} 