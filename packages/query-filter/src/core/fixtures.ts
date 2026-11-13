// Specs shared by the tests of the entries. A file of tests would be a leaf (tests-are-leaves), so the specs
// live in a plain file. Not exported by the package: the build excludes it.
import {
  Op,
  bool,
  date,
  datetime,
  decimal,
  defineFilter,
  int,
  oneOf,
  relation,
  str,
  uuid,
} from './index.js';

export enum OrderStatus {
  New = 'new',
  Paid = 'paid',
  Cancelled = 'cancelled',
}

export const groupFilter = defineFilter({
  legalEntityId: int(Op.Number),
  title: str(Op.String),
});

export const orderFilter = defineFilter({
  paid: bool(Op.Bool),
  total: decimal(Op.Number),
  status: oneOf(OrderStatus, Op.Enum),
});

export const userFilter = defineFilter({
  name: str(Op.eq, Op.neq),
  sname: str(Op.String),
  middleName: str(Op.String, Op.isnull, Op.nisnull),
  age: int(Op.Number),
  birthday: date(Op.Date),
  createdAt: datetime(Op.Date),
  ref: uuid(Op.Id),
  active: bool(Op.Bool),
  status: oneOf([OrderStatus.New, OrderStatus.Paid], Op.Enum),
  group: relation.one(groupFilter),
  orders: relation.many(orderFilter),
});
