export abstract class Entity<Id extends string = string> {
  protected constructor(readonly id: Id) {}

  equals(other?: Entity<Id>): boolean {
    if (!other) return false;
    return other.constructor === this.constructor && other.id === this.id;
  }
}
