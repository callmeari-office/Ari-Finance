function parseCsvValues(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function buildProposalStatusWhere(rawTrangThai) {
  const states = parseCsvValues(rawTrangThai);
  if (states.length === 0) return null;

  const clauses = states.map((state) => {
    if (state === 'THANH_TOAN_SAN') {
      return {
        trangThai: 'DA_THANH_TOAN',
        laLichSu: false,
        thuChiId: null,
      };
    }

    if (state === 'DA_THANH_TOAN') {
      return {
        trangThai: 'DA_THANH_TOAN',
        OR: [{ laLichSu: true }, { thuChiId: { not: null } }],
      };
    }

    return { trangThai: state };
  });

  return clauses.length === 1 ? clauses[0] : { OR: clauses };
}

export function buildProposalDateWhere(rawNam, rawThang) {
  const years = parseCsvValues(rawNam)
    .map((value) => parseInt(value, 10))
    .filter((value) => !Number.isNaN(value));

  if (years.length === 0) return null;

  const months = parseCsvValues(rawThang)
    .map((value) => parseInt(value, 10))
    .filter((value) => !Number.isNaN(value) && value >= 1 && value <= 12);

  if (months.length === 0) {
    if (years.length === 1) {
      const [year] = years;
      return {
        ngayPhatSinh: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      };
    }

    return {
      OR: years.map((year) => ({
        ngayPhatSinh: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      })),
    };
  }

  const ranges = years.flatMap((year) =>
    months.map((month) => ({
      ngayPhatSinh: {
        gte: new Date(Date.UTC(year, month - 1, 1)),
        lt: new Date(Date.UTC(year, month, 1)),
      },
    }))
  );

  return ranges.length === 1 ? ranges[0] : { OR: ranges };
}
