export type SortOrder = 'asc' | 'desc';

export interface PaginationInput {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface PaginationResult {
  skip: number;
  take: number;
  orderBy?: any;
  page?: number;
  limit?: number;
}

export function buildPagination(
  input: PaginationInput,
  allowedSortFields: string[] = [],
  defaultSort: { field: string; order: SortOrder } = { field: 'createdAt', order: 'desc' },
): PaginationResult {
  const page = input.page && input.page > 0 ? input.page : undefined;
  const limit = input.limit && input.limit > 0 ? input.limit : undefined;

  const take = typeof limit === 'number' ? limit : input.take && input.take > 0 ? input.take : 20;
  const skip = typeof page === 'number' ? (page - 1) * take : input.skip && input.skip >= 0 ? input.skip : 0;

  let orderBy: any | undefined;
  const sortBy = input.sortBy && allowedSortFields.includes(input.sortBy) ? input.sortBy : defaultSort.field;
  const sortOrder: SortOrder = input.sortOrder === 'asc' || input.sortOrder === 'desc' ? input.sortOrder : defaultSort.order;
  if (sortBy) orderBy = { [sortBy]: sortOrder };

  return { skip, take, orderBy, page, limit };
}
