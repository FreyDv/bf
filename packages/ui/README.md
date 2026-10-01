# @bf/ui

Shared shadcn/ui component library (raw TSX source, consumed directly by Next apps).

## Installation & Override

```bash
# Update and overwrite already installed components
ls ./src/components | sed 's/.tsx//' | xargs npx shadcn@latest add -o
```

## Usage

```ts
import { Button } from '@bf/ui/components/button';
import { cn } from '@bf/ui/lib/utils';
import '@bf/ui/globals.css';
```
