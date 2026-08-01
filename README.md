# Kubata

SaaS de dimensionamento e cálculo de quantidades/custo de materiais
para obras (construir, remodelar, ampliar), com editor visual
interactivo. "Kubata" = casa, em kimbundu.

Foco inicial: mercado Angolano. Contexto de produto (público-alvo,
diferencial, âmbito e fluxo) vive no vault
[cerebro-do-kiko](https://github.com/Thetectus/cerebro-do-kiko), em
`sessions/kubata/`.

## Estado actual

Protótipo inicial (MVP em desenvolvimento):
- Editor 2D (React + Konva): criar divisões/paredes, arrastar e
  redimensionar.
- Cálculo de quantidades de materiais em tempo real a partir das
  divisões desenhadas (cimento, areia, tijolo/bloco).
- Preço sugerido (baseline) por material, editável pelo utilizador por
  projecto — modelo híbrido definido no vault.
- Custo total estimado da obra, actualizado em tempo real.

Os coeficientes de cálculo (m² de parede → quantidade de material) são
valores de partida comuns na construção civil e **ainda precisam de
validação por um engenheiro civil** antes de qualquer uso real — ver
`src/lib/materials.ts`.

## Desenvolvimento

```sh
npm install
npm run dev
```

## Stack

- React + TypeScript + Vite
- Konva / react-konva (editor 2D)
- Zustand (estado do projecto)
