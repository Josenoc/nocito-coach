export type Plan = {
  key: string;
  name: string;
  price: number;
  months: number;
  days?: number;
};

export const PLANS: Plan[] = [
  { key: "estandar", name: "Plan Estándar (3 días)", price: 45000, months: 1, days: 3 },
  { key: "pro", name: "Plan Pro (4 días)", price: 60000, months: 1, days: 4 },
  { key: "elite", name: "Plan Elite (5 días)", price: 75000, months: 1, days: 5 },
  { key: "rutnut", name: "Rut&Nut", price: 50, months: 1 },
];

export function getPlan(index: number): Plan | undefined {
  return PLANS[index];
}

export function formatPrice(price: number): string {
  return "$" + price.toLocaleString("es-AR") + " ARS";
}