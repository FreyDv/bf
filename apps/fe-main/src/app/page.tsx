import Image from 'next/image';

import { Shell } from '@/components/shell';

export default function HomePage() {
  return (
    <Shell>
      <section className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Привет, Валерия! 🍰</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Скоро здесь появится сайт для продажи пирожных. Совсем немного терпения — и будет очень
          вкусно.
        </p>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-lg">
          <Image
            src="/cakes.jpg"
            alt="Шоколадный торт с кремовыми розетками"
            fill
            priority
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        </div>
      </section>
    </Shell>
  );
}
