export type Plan = {
  key: string;
  name: string;
  price: number;
  months: number;
};

export const PLANS: Plan[] = [
  { key: "rutnut", name: "Rut&Nut", price: 4999, months: 1 },
  {
    key: "habito",
    name: "Plan Hábito & Resultados (3 Meses)",
    price: 100500,
    months: 3,
  },
  {
    key: "presencial",
    name: "Full Presencial (Mensual)",
    price: 105000,
    months: 1,
  },
];

export function getPlan(index: number): Plan | undefined {
  return PLANS[index];
}

export function formatPrice(price: number): string {
  return "$" + price.toLocaleString("es-AR") + " ARS";
}