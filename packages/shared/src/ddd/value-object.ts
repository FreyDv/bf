/** Immutable value object compared by structural equality. */
export abstract class ValueObject<T> {
  protected constructor(readonly props: Readonly<T>) {
    Object.freeze(this.props);
  }

  equals(other?: ValueObject<T>): boolean {
    if (!other || other.constructor !== this.constructor) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
