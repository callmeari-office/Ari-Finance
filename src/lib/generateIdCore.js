export function getNextSequentialNumber(lastCode) {
  if (!lastCode) return 1;
  const parts = String(lastCode).split('-');
  const num = parseInt(parts[parts.length - 1], 10);
  return (isNaN(num) ? 0 : num) + 1;
}

export function buildSequentialCodes(prefix, startNumber, count) {
  return Array.from({ length: count }, (_, idx) => (
    `${prefix}${String(startNumber + idx).padStart(4, '0')}`
  ));
}

export function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}
