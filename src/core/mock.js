// Mock helpers (replace with real data layer later)

export function upperTriangleAvgCorrMock() {
  return Math.random();
}

export function generateRandomDailyVectorMock() {
  return [
    (Math.random() - 0.5) * 3, // x
    (Math.random() - 0.5) * 3, // y
    (Math.random() - 0.5) * 2, // rates
    (Math.random() - 0.5) * 2, // usd
    (Math.random() - 0.5) * 2, // vix
    (Math.random() - 0.5) * 2, // goldFear
  ];
}
