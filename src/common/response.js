'use strict';

const success = (res, data = {}, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const created = (res, data = {}, message = 'Created successfully') =>
  success(res, data, message, 201);

const paginated = (res, { data, total, page, limit, message = 'Success' }) => {
  const totalPages = Math.ceil(total / limit);
  return res.status(200).json({
    success: true, message, data,
    pagination: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  });
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const parsePagination = (query, defaults = { page: 1, limit: 10 }) => {
  const page  = Math.max(1, parseInt(query.page)  || defaults.page);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaults.limit));
  return { page, limit, skip: (page - 1) * limit };
};

module.exports = { success, created, paginated, asyncHandler, parsePagination };
