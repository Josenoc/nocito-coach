export type Plan = {
  key: string;
  name: string;
  price: number;
  months: number;
};

export const PLANS: Plan[] = [
  { key: "inicial", name: "Plan Inicial (1 Mes)", price: 300, months: 1 },
  {
    key: "transformacion",
    name: "Plan Transformación (2 Meses)",
    price: 76000,
    months: 2,
  },
  {
    key: "habito",
    name: "Plan Hábito & Resultados (3 Meses)",
    price: 100500,
    months: 3,
  },
  {
    key: "presencial",
    name: "Full Presencial (Mensual)",
    price: 126000,
    months: 1,
  },
];

export function getPlan(index: number): Plan | undefined {
  return PLANS[index];
}

export function formatPrice(price: number): string {
  return "$" + price.toLocaleString("es-AR") + " ARS";
}