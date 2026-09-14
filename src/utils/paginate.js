const paginate = async (
  pool,
  { baseQuery, countQuery, params = [], page = 1, perPage = 10, path },
) => {
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (currentPage - 1) * perPage;

  const [[{ total }]] = await pool.query(countQuery, params);

  const [rows] = await pool.query(`${baseQuery} LIMIT ? OFFSET ?`, [
    ...params,
    perPage,
    offset,
  ]);

  const lastPage = Math.max(Math.ceil(total / perPage), 1);

  return {
    rows,
    meta: {
      current_page: currentPage,
      from: total === 0 ? null : offset + 1,
      to: total === 0 ? null : offset + rows.length,
      last_page: lastPage,
      per_page: perPage,
      total,
      path,
    },
    links: {
      first: `${path}?page=1`,
      last: `${path}?page=${lastPage}`,
      prev: currentPage > 1 ? `${path}?page=${currentPage - 1}` : null,
      next: currentPage < lastPage ? `${path}?page=${currentPage + 1}` : null,
    },
  };
};

module.exports = paginate;
