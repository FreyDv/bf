# Domain-Driven Hexagon — external sources, part 3 (links 101-150)

- Source: links 101-150 of the Domain-Driven Hexagon README link list (README lines 597-1025, sections "Replacing primitives with Value Objects" through "Persistence models"); entries are in README order.
- Each entry states whether the page was fetched; where a page could not be read, the entry says so and anything added from memory is labelled "(from model knowledge, not fetched)".

- Fetch status summary: 40 of 50 pages were read in full or in the relevant part; the three npm package pages returned 403, so their GitHub READMEs (the same text npm renders) were read instead.
- Not readable: four Medium posts (HTTP 403), four Manning liveBook pages (preview/table of contents only), blog.yoavlavi.com (dead TLS certificate), twitter.com/jdegoes (redirects to x.com, HTTP 402), stackoverflow.com (blocked for the fetch tool).

---

## Value Objects Like a Pro — Nicolò Pignatelli (Medium) — https://medium.com/@nicolopigna/value-objects-like-a-pro-f1bfc1548c72
- Cited by README at line 597 in section "Replacing primitives with Value Objects" to support: recommended reading on value objects as the cure for primitive obsession.
- Fetch status: NOT FETCHED — Medium returned HTTP 403 to the fetch tool. Nothing below is verified against the page.
- What it argues (from model knowledge, not fetched; details unverified): value objects are the smallest expressive building blocks of a domain model — immutable, compared by value not identity, validated once in their constructor so an instance is always valid, and carrying the behaviour that belongs to the concept (e.g. money arithmetic, email domain extraction) instead of leaving that logic scattered in services.
- Recommendations usually attributed to this post (from model knowledge, not fetched): replace primitives in signatures with value objects to make APIs self-documenting and to stop argument-order mistakes; no setters, replace the whole value instead of mutating; implement equality/hash on all components; keep them small and compose bigger ones from smaller ones; name them in the ubiquitous language.
- Examples: the post uses JVM-language code (Java/Kotlin style) as far as I recall; not verifiable here.
- Caveats named by the README itself at lines 586-589: in TypeScript wrapping every primitive adds boilerplate (`email.value`) and object-creation overhead; for small projects it is overkill; create classes only for primitives with real rules or validate outside the domain.

## "Secure by Design" Chapter 5: Domain Primitives — Dan Bergh Johnsson, Daniel Deogun, Daniel Sawano (Manning liveBook) — https://livebook.manning.com/book/secure-by-design/chapter-5/
- Cited by README at line 598 in section "Replacing primitives with Value Objects" to support: the full-chapter version of the "Domain Primitives" article; value objects as a security tool.
- Fetch status: PARTIAL — liveBook shows only the chapter opening, Table 5.1 and section headings; the body text is paywalled.
- What is visible on the page:
  - Table 5.1 maps each technique to the problem it mitigates: domain primitives and invariants → inexact, error-prone, ambiguous code; read-once objects → leakage of sensitive data; "standing on the shoulders of domain primitives" → code burdened by too much complexity.
  - Section topics (from headings): domain primitives as the smallest building blocks; context boundaries define meaning; building a domain-primitive library; hardening APIs with that library; avoiding exposing the domain publicly; read-once objects (detecting unintentional use, avoiding leaks caused by evolving code); the risk of overcluttered entity methods and decluttering them; when to use domain primitives in entities; taint analysis.
  - Stated premise: the individual chapter-4 constructs (immutability, fail fast, validation) help against invalid input, illegal state and integrity loss, but applying them one by one is not enough; domain primitives combine them.
- From model knowledge, not fetched (the chapter's substance as published):
  - Definition: a domain primitive is a value object that is always valid in its bounded context — its constructor rejects anything that is not a legal value of that concept (quantity, email, zip code), it is immutable, and its name comes from the ubiquitous language; invalid instances cannot exist, so code that receives one need not re-check it.
  - Rule: meaning is contextual — the same string is a valid "username" in one context and not in another, so the primitive belongs to one context.
  - Rule: harden APIs by replacing `String`/`int` parameters with domain primitives; this gives input validation at the boundary for free and removes ambiguous argument order.
  - Read-once object: a wrapper for sensitive data (password, card number) whose value can be retrieved exactly once (second read throws), with `toString`/serialization neutered, so accidental logging or copying is detected; evolving code that starts to reuse the value fails loudly.
  - Entities built on domain primitives have far less validation clutter in methods; taint analysis is the compiler/tool-based tracking of untrusted data until it is validated.
- How it applies to TypeScript/NestJS: the README's `ValueObject` base class with constructor validation is the TypeScript equivalent; read-once semantics would be a class with a one-shot getter.

## Algebraic Data Types (ADT) — Wikipedia — https://en.wikipedia.org/wiki/Algebraic_data_type
- Cited by README at line 602 in section "Make illegal states unrepresentable" to support: using ADTs (sum/product types) with value objects to make illegal states impossible to represent (also cited again at 670 and in "Domain Errors" for typed error sets).
- Fetch status: fetched.
- What it defines: an ADT is a composite type built from two constructions — sum ("OR", choice among tagged variants) and product ("AND", one value per component); not to be confused with abstract data types.
- Sum types: a value is exactly one of several variants (traffic light Red | Amber | Green; shape Circle(radius) | Square(width)); formally a tagged/disjoint union; each variant has a named constructor that may carry data; an enum is a sum type whose constructors carry no data.
- Product types: a value holds one value of each component (Point with x and y); tuples and records; the value set is the Cartesian product.
- Origins: introduced in Hope (University of Edinburgh, 1970s; Burstall, MacQueen, Sannella); now first-class in Haskell, ML, OCaml, F#, Scala, Rust, Swift, Elm, Kotlin, Java 16/17 (records/sealed), TypeScript, Python and many more.
- Examples (Haskell): `data List a = Nil | Cons a (List a)`; `data Tree = Empty | Leaf Int | Node Int Tree Tree` (recursive because Node holds two Trees; `Leaf` is logically a function Int -> Tree); an `Expression` ADT (Number | Add | Minus | Mult | Divide) for abstract syntax, over which compiler passes are written.
- Pattern matching: values are deconstructed by matching constructor patterns (first match wins, variables bound, patterns recurse — red-black tree balancing needs patterns several levels deep); operationally equivalent to a switch on the tag, but with two compiler-provided advantages: type safety (only fields that exist for that constructor are accessible) and exhaustiveness checking (missing or unreachable cases are reported).
- Theory: a general ADT is a possibly recursive sum of products; a nullary constructor is the empty product; a single-constructor type is a product; `List` is λα.μβ.1 + α×β; the alternative μφ.λα.1 + α×φα supports nested data types (Bird, Meertens, Paterson); set-theoretically a sum is a disjoint union of (tag, value) pairs.
- Caveats: the article has no criticism section; it is tagged as needing more citations.
- How it applies to TypeScript: sum types are discriminated unions (`{kind:'a'} | {kind:'b'}`), product types are object types/tuples; exhaustiveness is obtained with a `never` check (see the TypeScript handbook entry below).

## John A De Goes — Twitter/X profile — https://twitter.com/jdegoes
- Cited by README at line 606 in section "Make illegal states unrepresentable" to support: attribution of the quote that making illegal states unrepresentable means statically proving every runtime value is a valid domain object.
- Fetch status: NOT FETCHED — twitter.com redirects to x.com, which returned HTTP 402; the profile is not readable without login.
- What it is (from model knowledge, not fetched): the profile of John A. De Goes, a functional-programming advocate, author of the ZIO library for Scala and founder of Ziverge; the README only uses the handle to attribute the quote, no other content is implied.

## union type — TypeScript Handbook v1, "Unions and Intersection Types" (typescriptlang.org) — https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#union-types
- Cited by README at line 639 in section "Validation at compile time" to support: expressing "email, or phone, or both" as `type ContactInfo = Email | Phone | [Email, Phone]` instead of two optional fields.
- Fetch status: fetched. The page carries a deprecation notice: it has been replaced by the v2 handbook page "Everyday Types" (#union-types).
- What it defines: a union type `A | B | C` is a value that is one of the members; an intersection `A & B` has all members of both.
- Rules and reasoning:
  - Prefer a union over `any` for "number or string" parameters: with `any`, `padLeft("Hello", true)` compiles and fails at runtime; with `string | number` it is a compile error. A class hierarchy would be more explicit but is overkill and does not help functions that take primitives.
  - On a union only members common to every constituent are accessible: with `Fish | Bird`, `pet.layEggs()` is fine, `pet.swim()` is an error (it would fail at runtime for a Bird).
  - Discriminated unions: give every member a shared literal-typed field (`state: "loading" | "failed" | "success"`), then `switch (state.state)` narrows each case to the right member; accessing `state.code` before narrowing is an error.
  - Exhaustiveness method 1: with `strictNullChecks` and an explicit return type, a missing case produces "Function lacks ending return statement and return type does not include 'undefined'"; the page calls this subtle and notes it may not work with old code.
  - Exhaustiveness method 2: `function assertNever(x: never): never { throw new Error("Unexpected object: " + x) }` in the `default` branch; a missing case makes the argument non-`never`, and the error message names the missing member type.
- Examples (TypeScript): `padLeft(value: string, padding: string | number)`; `NetworkState = NetworkLoadingState | NetworkFailedState | NetworkSuccessState` with a `logger` switch; adding `NetworkFromCachedState` to show the exhaustiveness error; `type ArtworksResponse = ArtworksData & ErrorHandling` to compose shared error-handling fields into response types.
- Caveats: adding a union member requires updating every switch — which is the point; method 2 costs an extra helper function.

## Making illegal states unrepresentable — Chris Krycho (v5.chriskrycho.com, 2020) — https://v5.chriskrycho.com/journal/making-illegal-states-unrepresentable-in-ts/
- Cited by README at line 653 in section "Validation at compile time" to support: the typestate / illegal-states-unrepresentable idea in TypeScript specifically.
- Fetch status: fetched.
- What it argues: Scott Wlaschin's F# technique (types that cannot express invalid domain states) translates almost directly to TypeScript and removes whole classes of business-logic bugs at compile time; the post is explicitly a translation of Wlaschin's article, borrowing its headings.
- Recommendations and rules:
  - Treat data classes as immutable records: `public readonly` constructor parameter properties, no mutation, "update" methods return a new instance (JavaScript lacked native records/tuples).
  - Wrap primitives in distinct types (`Name`, `EmailContactInfo`, `PostalContactInfo`) so a bare `string` or the wrong wrapper cannot be passed.
  - Add a `private` member (or private constructor) to get nominal distinction, because TypeScript's structural typing treats same-shaped types as interchangeable.
  - Use a private constructor plus a static `create` factory that returns `undefined` (or the instance) so an invalid instance cannot be built (smart constructor); the email regex used is admittedly weak.
  - Model the rule (email or postal address, at least one) as a union of three valid variants, not as two optional fields; optional fields allow the illegal "neither" state and are tempting because of optional chaining and the many optional JS APIs.
  - Do not re-validate values that already carry a validated type.
  - Handle every variant explicitly in update logic; prefer names like `withNewPostalAddress` over `updatePostalAddress`.
  - Use exhaustiveness checking (`assertNever` in `default`) so adding a variant breaks every unhandled site at compile time — intended, because a changed business rule should surface everywhere.
- Vocabulary: single-case wrapper type; structural vs nominal typing; smart constructor; tagged/discriminated union (literal `type` field); exhaustiveness check; literal types / `as const`.
- Examples (TypeScript): `Contact(name, contactInfo)` with `type ContactInfo = EmailContactInfo | PostalContactInfo | [EmailContactInfo, PostalContactInfo]`; factories `fromEmail`, `fromPostalAddress`, `fromEmailAndPostal` returning `Contact | undefined`; `updatePostalAddress` with three `instanceof` branches (email-only → both; postal-only → replaced; both → postal replaced); appendix version with `readonly type: 'EmailContactInfo'` tags, an `EmailAndPostal` wrapper class, and a `describe()` switch ending in `assertNever`.
- Language comparison: F#, Elm, OCaml, Rust and Swift enums have compiler-generated tags; TypeScript emulates tags with literal types because JavaScript has none.
- Trade-offs and caveats: tags add a little per-instance data; the pattern requires team familiarity (`instanceof` is more familiar to JS developers, a tag `switch` is clearer than long if/else chains); immutability is by convention only; tuples are rarer in TS because they share array syntax; the resulting code looks more complex because the business rule is genuinely complex — simpler-looking code is usually not handling all cases. The article's own code has slips (a raw `email` string placed in a tuple, a missing `return`, an undefined `Email` type, `this.info` vs `contactInfo`), so copy with care.

## Typestates Would Have Saved the Roman Republic — Yoav Lavi (blog.yoavlavi.com) — https://blog.yoavlavi.com/state-machines-would-have-saved-the-roman-republic/
- Cited by README at line 654 in section "Validation at compile time" to support: the typestate pattern (run-time state encoded in the compile-time type).
- Fetch status: NOT FETCHED — the host now presents a Fastly fallback TLS certificate (site appears to be offline), and the Wayback Machine is not reachable from the fetch tool.
- What it argues (from model knowledge, not fetched; details unverified): a Rust article that uses the Roman cursus honorum — the fixed ladder of magistracies (quaestor, aedile, praetor, consul) with minimum ages and mandatory gaps — as a state machine, and shows that encoding the ladder as typestates (`Politician<Quaestor>` can only turn into `Politician<Aedile>` through a transition that consumes the old value) makes "skipping steps" a compile error; the historical hook is that the late Republic's rules were only enforced by convention and were broken (e.g. Pompey reaching the consulship without prior offices), i.e. illegal states were representable.
- Rules it supports (as cited by the README): put allowed transitions in the type system so illegal sequences cannot be written; see the Cliffle entry below for the mechanics.

## The Typestate Pattern in Rust — Cliff L. Biffle (cliffle.com, 2019) — https://cliffle.com/blog/rust-typestate/
- Cited by README at line 655 in section "Validation at compile time" to support: the definition of the typestate pattern quoted by the README (encoding run-time state in the compile-time type).
- Fetch status: fetched.
- What it argues: an API designed with typestate has three properties — some operations are only available in some states, states are encoded in types so misuse fails to compile, and state transitions change the type so earlier-state operations become unavailable; Rust makes this natural because of checked move semantics, which most languages lack.
- Recommendations and rules:
  - Make state-transition methods consume `self` (take by value) so the old-state object is moved away and cannot be used afterwards; this is what makes the pattern enforceable.
  - Use `&self`/`&mut self` for operations that do not change state; consuming `self` everywhere makes loops awkward (`r = r.header(...)`); returning `&mut Self` optionally enables chaining.
  - Keep per-state wrappers cheap: wrap a `Box` to the real state so consume-and-recreate is a pointer move.
  - Store state-specific data in the state type rather than in `Option` fields: wrong-state code cannot touch it, no `None` handling, no wasted space.
  - Use a sealed trait for the state parameter if outsiders must not add states.
  - Candidates for typestate: any run-time order-of-operations rule — validate before translate, no I/O after close, authenticate before send, "after A do exactly one of B or C, then D".
  - Documentation note: separate `impl HttpResponse<State>` blocks give each state its own rustdoc section.
- Vocabulary: typestate (compile-time tracking of run-time state; links to typestate analysis); RAII as a two-state typestate; move semantics vs C++ "move" (moved-from object still accessible → UB); linear types; phantom types and `PhantomData`; zero-variant enum (`enum Start {}`, cannot be instantiated); sealed trait pattern; safe vs unsafe code.
- Examples (Rust):
  - `File::open` is the only way to get a `File`, so holding one means it is open; `drop(file)` takes it by value so a later read fails to compile.
  - HTTP response builder as separate types: `HttpResponse::status_line(self, …) -> HttpResponseAfterStatus`; `header(&mut self, …)`; `body(self, text)` returns `()` and ends the object.
  - Generic version: `struct HttpResponse<S: ResponseState> { state: Box<ActualResponseState>, marker: PhantomData<S> }` with `enum Start {}`, `enum Headers {}`, `trait ResponseState {}`, and per-state `impl` blocks.
  - Sharing behaviour: `impl<S> HttpResponse<S>` for all states; `impl<S: SendingState> HttpResponse<S>` with a marker trait for a subset.
  - States carrying data: replace `PhantomData<S>` with `extra: S`, e.g. `struct Headers { response_code: u8 }`.
  - Serde's `Serializer::serialize_struct` → `SerializeStruct` → `end` is typestate in the wild: it prevents double `serialize_struct`, mixing with `serialize_i32`, fields after `end`.
- Trade-offs and caveats: guarantees hold only in safe Rust; separate-types-per-state spreads docs and needs boilerplate, generic-parameter version is more powerful but harder to explain and needs `PhantomData` and sealing; `Option<T>` for state-dependent data is the anti-pattern; a robust implementation needs checked moves or linear types, so the author doubts other languages can do it well.
- How it applies to TypeScript/NestJS: TS has no move semantics, so the README's union-type `ContactInfo` is the achievable subset — distinct types per state with transitions returning a new type; nothing stops reuse of the old value, so the compile-time guarantee is weaker than Rust's.

## Make illegal states unrepresentable — but how? The Typestate Pattern in Erlang — Radek Szymczyszyn (erszcz, Medium) — https://erszcz.medium.com/make-illegal-states-unrepresentable-but-how-the-typestate-pattern-in-erlang-16b37b090d9d
- Cited by README at line 656 in section "Validation at compile time" to support: further reading on typestate.
- Fetch status: NOT FETCHED — Medium returned HTTP 403.
- What it argues (from model knowledge, not fetched; details unverified): Erlang is dynamically typed, so typestate is approximated with Dialyzer: declare one opaque type per state (e.g. an opened vs closed handle), give each function a `-spec` that accepts one state type and returns the next, and let Dialyzer's success typing report calls that pass a value of the wrong state; records or tagged tuples carry the state tag at run time.
- Caveats (from model knowledge, not fetched): Dialyzer only reports definite errors (optimistic analysis), so some misuse passes; without linear types the old-state value remains usable after a transition, so the guarantee is weaker than Rust's.

## Design by contract — Wikipedia — https://en.wikipedia.org/wiki/Design_by_contract
- Cited by README at line 666 in section "Validation at runtime" to support: defining preconditions in constructors and checking postconditions/invariants before saving, as the domain's second line of defence.
- Fetch status: fetched.
- What it defines: Design by Contract (DbC, contract programming) — components get formal, precise, verifiable interface specifications: preconditions, postconditions and invariants that extend abstract data types, by analogy with business contracts; coined by Bertrand Meyer for Eiffel (articles 1986, OOSC 1988/1997); "Design by Contract" is a US trademark of Eiffel Software (granted 2004); rooted in Hoare logic and formal specification.
- The three obligations per method:
  - Precondition: what the caller must guarantee on entry (client's obligation, supplier's benefit — the supplier need not handle other cases).
  - Postcondition: what the method guarantees on exit (supplier's obligation, client's benefit).
  - Class invariant: holds on entry and exit of every public feature, keeping object state within bounds.
  - Correctness criterion: if invariant and precondition hold before a call, invariant and postcondition hold after; clients must never violate preconditions.
- Rules and reasoning:
  - Clients are assumed to satisfy preconditions; where that is too risky (multi-channel, distributed systems) the server checks them and returns an error — the "defensive" inverse.
  - Under DbC the supplier verifies contract conditions and the code fails hard on violation ("offensive programming"); contracts are the safety net and make intended behaviour explicit, which simplifies debugging; in defensive programming the supplier decides what to do with bad input (often throws); either way the client decides how to respond.
  - Inheritance: a subclass may weaken preconditions and strengthen postconditions/invariants, never the reverse (behavioural subtyping, Liskov).
  - A contract should specify: acceptable/unacceptable inputs and their meaning; return values and meaning; error/exception conditions; side effects; pre/postconditions and invariants; rarely, performance guarantees.
  - DbC complements, not replaces, unit/integration/system tests: contract checks are internal self-tests that run during isolated tests or during a production test phase, catching errors earlier and more specifically; assertions can serve as a test oracle; advocates write assertions first (citation needed on the page).
  - Performance: in a correct program contracts never fire, so they are checked in debug builds and disabled in release (C/C++ asserts compiled away, C#/Java assertions off by default, Python `-O` drops asserts).
- Language support listed: Ada 2012/SPARK, Ciao, Clojure, Cobra, C++26, D, Dafny, Eiffel, Fortress, Kotlin, Mercury, Oxygene, Racket (higher-order contracts with blame), Sather, Scala, Vala, VDM; CLOS `:before/:after/:around` methods can express contracts. TypeScript/JavaScript and library-based support are not mentioned.
- Caveats: no criticism section; several "citation needed" tags.
- How it applies to TypeScript/NestJS: the README's `guard.ts` helpers in constructors are preconditions; invariants are checked in the entity's `validate()` before persistence; there is no compile-away mechanism, so keep guards cheap.

## Backend Best Practices: Data Validation — Sairyss (GitHub README) — https://github.com/Sairyss/backend-best-practices#data-validation
- Cited by README at line 674 in section "Validation at runtime" to support: what to validate at runtime and in what order.
- Fetch status: fetched.
- What it argues: all input to an API must be validated; validation is critical for security. Six checks, in order:
  - Origin — is the sender legitimate? Where possible accept data only from authorized users or whitelisted IPs (situation-dependent).
  - Existence — is it non-empty? Null/undefined, empty objects, empty arrays; later checks are pointless on empty data.
  - Size — is it reasonably big? Check length/size before anything else regardless of type, because validating oversized input can block a thread and oversized payloads can be a DoS attack.
  - Lexical content — right characters and encoding? If only digits are expected, anything else means broken or malicious data.
  - Syntax — right format? Sometimes a regexp suffices, sometimes parsing (XML, JSON) is required.
  - Semantics — does it make sense against the rest of the system (database, other processes)? e.g. does the referenced item id exist.
- Ordering rule: cheap checks (null, length) first, expensive checks that hit the database last.
- Example: the DDH repo's `create-user.request.dto.ts` shows existence/size/lexical checks with class-validator decorators; it does not show syntax or semantic checks.
- Further reading it points to: OWASP Input Validation Cheat Sheet; Secure by Design chapter 4.3 "Validation".
- Caveats: the section does not cover sanitization or specific regex patterns; the origin check is conditional.

## Fail Fast principle — Vladimir Khorikov (Enterprise Craftsmanship, 2015) — https://enterprisecraftsmanship.com/posts/fail-fast-principle
- Cited by README at line 692 in section "Guarding vs validating" to support: guards comply with fail-fast by throwing runtime exceptions on invariant violation.
- Fetch status: fetched.
- What it argues: stop the current operation immediately on any unexpected error; hidden failures are worse than visible ones because they lengthen the feedback loop and can corrupt persisted data.
- Recommendations and rules:
  - Never wrap code in a generic try/catch that swallows exceptions: it masks defects (sometimes for a long time), and continuing after an error can write invalid in-memory state to the database — corruption that a restart does not fix. The justification that hidden errors make software feel more stable is rejected.
  - If you log in a catch block, rethrow afterwards.
  - Configuration: read and validate every required setting at startup and crash if anything is missing or invalid; afterwards you know there are no configuration problems. The opposite — reading settings ad hoc where used — fails late or silently.
  - Nulls: prefer non-nullable reference types enforced by the compiler; failing that, throw at the moment an unexpected null is assigned, not where it is later dereferenced (null reference exceptions surface far from their cause).
  - Scope of the shutdown: stateful processes should terminate (ideally with an apology to the user); stateless software (web request handlers, background jobs, nothing kept in memory between operations) can halt only the failed operation and keep running.
  - Expect many crashes when first applying fail-fast to an existing system; persist and fix the underlying code.
  - Even in production it is better to tell the user something went wrong than to hide it; production bugs cost an order of magnitude more than development bugs.
- Vocabulary: fail fast; fail silently ("burying your head in the sand"); feedback loop; persistence state; data corruption; design by contract as fail-fast taken to the extreme (formal rules, crash on violation); code contracts and static analyzers that find violations at compile time; stateless software.
- Examples (C#, paraphrased): `try { DoSomething(); } catch (Exception ex) { Log(ex); }` (fail-silently) vs the same with `throw;` after logging; startup configuration validation; a web request that fails alone.
- Trade-offs/anti-patterns: generic exception swallowing; fail-silently; initial pain on adoption; C# lacked non-nullable reference types at the time (Roslyn issue cited).
- How it applies to TypeScript/NestJS: `strictNullChecks` gives the non-nullable types the post wanted; the README's guards throw `ArgumentNotProvidedException`-style errors; a NestJS request handler is the stateless case where only the request fails.

## Refactoring: Guard Clauses — Better Programming (Medium) — https://medium.com/better-programming/refactoring-guard-clauses-2ceeaa1a9da
- Cited by README at line 704 in section "Guarding vs validating" to support: guard clauses as the mechanism for domain self-protection.
- Fetch status: NOT FETCHED — Medium returned HTTP 403.
- What it argues (from model knowledge, not fetched; details unverified): the Fowler refactoring "Replace Nested Conditional with Guard Clauses" — check the special, invalid or trivial cases at the top of a function and return or throw immediately, so the normal path reads unindented and the reader is told that the guarded cases are not the main flow.
- Rules usually given in this kind of article (from model knowledge, not fetched): one guard per condition, placed first; prefer early return/throw over an accumulating `else` chain; the old "single exit point" rule is not worth the nesting; guards make precondition failures visible immediately (fail fast); code examples are typically JavaScript/TypeScript before/after snippets.

## Always-Valid Domain Model — Vladimir Khorikov (Enterprise Craftsmanship, 2021) — https://enterprisecraftsmanship.com/posts/always-valid-domain-model/
- Cited by README at line 705 in section "Guarding vs validating" to support: the distinction between guarding (invariants, exceptional) and validating (input filtration, not exceptional) — the README's blockquote at lines 686-687 is from this post.
- Fetch status: fetched.
- What it argues: domain classes must always guard themselves against becoming invalid (a response to Jeffrey Palermo's 2009 "not-always-valid" argument, partly answered earlier by Greg Young); input validation and domain invariants come from the same business rules and differ only in perspective.
- Recommendations and rules:
  - Invariants define the class (a triangle with a fourth edge is a square); keep the check inside the class (DRY) rather than repeating it in every operation.
  - The same business rule appears as an invariant in the domain model and as input validation in application services; invariant violation is exceptional → throw; invalid external input is not exceptional → return a `Result`.
  - Filtration in the application layer is the first line of defence and returns a polite error; data that passed it is assumed valid; a domain exception afterwards means the filtration is buggy and must be fixed (fail fast); race conditions are the exception where the domain may also need to return a result.
  - "Data validation vs business-rules validation" is a false split — all validation comes from business requirements; the only real difference is tooling: simple rules suit FluentValidation/data annotations, complex rules belong in controllers/command handlers; moving complex rules into FluentValidation fragments the flow.
  - Context is part of the rule: large scale → Bounded Contexts with different invariants per context; small scale → encode the context in the class with a CanExecute/Execute pair (`CanEnrollIn` used by the controller for filtration and again by `EnrollIn`, which throws if it fails).
  - Prefer the type system to runtime guard clauses: separate `Student`/`Instructor` classes instead of a `Person` with a type enum and guards — misuse becomes a compile error (fail fast taken to the extreme).
  - Separate data contracts (DTOs) from domain classes; materialising requests straight into entities is what forces invalid states and blocks domain refactoring.
  - Text messages belong to the presentation layer: domain methods return an `Error` type (`UnitResult<Error>`, e.g. `Errors.InactiveStudentsCannotEnrollInNewCourses()`), converted to text outside.
  - Validation strengthening with historical data: options are delete old data (only pre-production), make the entity handle both rule sets (rejected), or create a separate class for the new rules (preferred, e.g. `StudentWithAddress : Student`), remove the old class after migration and rename; naming from the ubiquitous language.
  - Large forms/wizards with saved progress: model the interim state explicitly as its own entity with looser invariants (`StudentApplication`), persist it, and convert to `Student` on final submit after full validation.
- Vocabulary: always-valid vs not-always-valid domain model; invariant; input validation / filtration; Result class; fail fast; CanExecute pattern; Bounded Context; validation strengthening; data contract; interim entity.
- Examples (C#): controller returns an error string on null name while `Student.UpdateName` throws `ArgumentNullException`; `CanEnrollIn(course)` returning `Result.Failure` when not `Active`; enum-based guard clauses vs subclasses; `StudentWithAddress`; `StudentApplication`.
- Anti-patterns/caveats: letting entities hold invalid state to validate later; two rule sets in one class; deleting production data; display text in the domain; duplicated invariant checks; exceptions in the domain are defects to fix, not flow; runtime guards are weaker than types; transition periods carry two rule sets.
- How it applies to TypeScript/NestJS: the README mirrors this — class-validator on request DTOs (filtration), `Guard` helpers in value objects/entities (invariants that throw), `Result`/`Err(...)` for business failures in command handlers.

## class-validator — typestack (npm) — https://www.npmjs.com/package/class-validator
- Cited by README at line 714 in section "Guarding vs validating" to support: using a validation library on DTOs outside the domain while keeping only basic guards inside (also cited at 931 for DTO decorators).
- Fetch status: npm page returned HTTP 403; the package README was read from github.com/typestack/class-validator (the same README npm renders).
- What it does: decorator-based (and function-based) validation of class instances, built on validator.js, running in Node and browsers; `validate(obj, options?)` resolves to `ValidationError[]`; `validateOrReject` rejects instead; `validateSync` ignores async validators; standalone functions (`isEmail()` etc.) for manual checks.
- Key API:
  - `ValidationError` fields: `target` (the object), `property`, `value`, `constraints` (constraint name → message), `children` (nested errors), `contexts` (custom data from a decorator's `context` option).
  - Messages: per-decorator `message` string or function receiving `ValidationArguments` (`value`, `constraints`, `targetName`, `object`, `property`); tokens `$value`, `$property`, `$target`, `$constraint1..N`.
  - Options: `skipMissingProperties` (only `@IsDefined()` ignores it), `whitelist` (strip undecorated properties; `@Allow()` keeps one), `forbidNonWhitelisted` (error instead of strip), `groups` + `always: true`, `dismissDefaultMessages`, `validationError: { target, value }`, `forbidUnknownValues` (default `true`, the README says keep it — `false` lets unknown objects pass), `stopAtFirstError`.
  - `each: true` validates every element of arrays, Sets and Maps; `@ValidateNested()` for nested class instances (multidimensional arrays supported); `@ValidatePromise()` for Promise-valued properties; `@ValidateIf(fn)` disables all validators on a property when false, plus a per-decorator `validateIf`; subclasses inherit parent decorators (both apply on redefined properties).
  - Custom validators: `@ValidatorConstraint({ name, async })` class implementing `validate()`/`defaultMessage()`, attached with `@Validate(Class, constraints?, options?)`; custom decorators via `registerDecorator({ name, target, propertyName, constraints, options, validator })`; `useContainer()` for DI (typedi shown).
  - Decorator families: common (`@IsDefined`, `@IsOptional`, `@Equals`, `@IsEmpty`, `@IsNotEmpty`, `@IsIn`), type (`@IsBoolean`, `@IsDate`, `@IsString`, `@IsNumber`, `@IsInt`, `@IsArray`, `@IsEnum`), number (`@Min`, `@Max`, `@IsPositive`, `@IsDivisibleBy`), date (`@MinDate`, `@MaxDate`), string (~100: `@IsEmail`, `@IsUrl`, `@Length`, `@Matches`, `@IsUUID`, `@IsStrongPassword`, `@IsJWT`, `@IsPhoneNumber`, …), array (`@ArrayNotEmpty`, `@ArrayMinSize`, `@ArrayUnique`, …), object (`@IsInstance`, `@IsObject`, `@IsNotEmptyObject`).
- Rules and caveats: objects must be class instances (`new Class()`), so transform JSON with class-transformer first; set `validationError.target: false` before returning errors over HTTP; a `groups` combination matching no decorator yields an unknown-value error; schema-based (decorator-less) validation broke in 0.12 and will not be fixed; `validateSync` skips async validators.
- Why the README cites it: all validation errors are collected before returning (Notification pattern) by default, and it keeps the general-purpose library at the DTO boundary, away from domain objects.

## Either — Cats documentation (Typelevel) — https://typelevel.org/cats/datatypes/either.html
- Cited by README at line 745 in section "Domain Errors" to support: a Result/Either monad with Success/Failure as the alternative to throwing, as used in Haskell/Scala.
- Fetch status: fetched twice. The live page today is a short stub; the full article the README refers to was read from the Cats v2.6.1 source (`docs/src/main/mdoc/datatypes/either.md`). Both are captured.
- Live page (current): `Either` comes from the Scala standard library; Cats adds syntax enrichment (see the Jump Start Guide's Either helpers) and type-class instances (Functor, Applicative, Monad, MonadError); `Either` short-circuits on the first error — use the `Parallel` type class or `Validated` to accumulate errors instead.
- Full article — what it argues: the Scala compiler does not track exceptions at all, so the only way to learn what a function can throw is to read its source; composing several throwing functions makes failure modes untraceable (two functions throwing the same `IllegalArgumentException` cannot be told apart); the fix is to make failure explicit in the return type as `Either[Error, Value]`.
- Rules and reasoning:
  - `Either` is right-biased: `map`/`flatMap` operate on `Right`. In Scala 2.10/2.11 it was unbiased and required `.right`/`.left` projections (`LeftProjection`/`RightProjection`) for every combinator call, which is verbose; Scala 2.12 made it right-biased; `cats.syntax.either._` (or `cats.implicits._`) provides the same on older versions.
  - Compose fallible steps with `map`/`flatMap`; the first `Left` short-circuits.
  - Use a sealed error ADT instead of `Exception` subclasses: round 1 matched on `NumberFormatException`/`IllegalArgumentException` and still needed a catch-all `Left(_)`; round 2's `sealed abstract class Error` with `NotANumber(string)` and `case object NoZeroReciprocal` lets the compiler check exhaustiveness and stops outside code adding cases.
  - "Either in the small, Either in the large": do not share one application-wide error type across modules (solution 1) — every consumer must then handle cases it can never produce. Instead keep each module's errors local (`DatabaseError`, `ServiceError`) and wrap them in an application-level ADT (`AppError.Database(e)`, `AppError.Service(e)`) by lifting with `leftMap` (solution 2), so callers can match whole classes of errors.
  - `Either` is a `Monad` once the left type is fixed: `implicit def eitherMonad[Err]: Monad[Either[Err, *]]` with a stack-safe `@tailrec tailRecM` (needs the kind-projector plugin).
  - Interop with throwing code: `Either.catchOnly[NumberFormatException]("abc".toInt)` catches only the named type; `Either.catchNonFatal(...)` yields `Either[Throwable, Int]`; manual try/catch is described as tedious.
  - Choose by intent: `Either` short-circuits; `Validated` accumulates.
- Examples (Scala): `parse(s): Either[Error, Int]`, `reciprocal(i): Either[Error, Double]`, `stringify(d): String`, `magic(s) = parse(s).flatMap(reciprocal).map(stringify)` with a pattern match over `Left(NotANumber(_))`, `Left(NoZeroReciprocal)`, `Right(_)`; `doApp = Database.databaseThings().leftMap[AppError](AppError.Database).flatMap(dv => Service.serviceThings(dv).leftMap(AppError.Service))`.
- Caveats: `flatMap[AA >: A, Y]` is covariant in the left type, so mixing different error types silently infers `Object`/a common supertype (the "nasty variance issue"); a sealed ADT requires the error set to be enumerated up front; `catchNonFatal` can be too broad; every caller must handle the explicit errors.
- How it applies to TypeScript/NestJS: the README's `Result<T, E>` from oxide.ts plays the role of `Either`; the sealed ADT becomes a union of error classes (`CreateUserError = UserAlreadyExistsError | IncorrectUserAddressError`); the in-the-large advice maps to per-module error unions wrapped at the application layer.

## oxide.ts — npm (traverse1984) — https://www.npmjs.com/package/oxide.ts
- Cited by README at line 811 in section "Domain Errors" to support: the Result object library used in the project (`Ok`, `Err`, `match`, `unwrap`).
- Fetch status: npm page returned HTTP 403; the README was read from github.com/traverse1984/oxide.ts (v1.1.0 shown).
- What it does: Rust's `Option<T>` (`Some`/`None`) and `Result<T, E>` (`Ok`/`Err`) for TypeScript, zero dependencies, full test coverage, in-editor docs; import everything from `"oxide.ts"` or `"oxide.ts/core"` to leave out `match`.
- Key API:
  - Extracting: `unwrap`, `expect`, `unwrapOr`, `mapOr`; on Result also `unwrapErr`, `expectErr`; `into(default)` returns `T` or the fallback; `intoTuple` returns `[null, T]` or `[E, null]` (1.1.0).
  - Transforming: `map`, `mapErr`, `flatten` (1.1.0); Option and Result share one API so chains can be written before unwrapping; they nest (`Result<Option<T>, E>`).
  - Converting in: `Option.from`/`Result.from` treat falsy values, `Error` instances and invalid Dates as empty; `Option.nonNull` rejects only `undefined`, `null`, `NaN` (keeps `0`); `Option.qty` accepts finite integers ≥ 0.
  - Safe wrappers: `Result.safe(fn)` or `Result.safe(promise)` captures a throw/rejection as `Err` (non-Error throws are wrapped in an Error).
  - Combining: `Result.all` → first `Err` or array of all `Ok` values; `Result.any` → first `Ok` or an `Err` holding every error.
  - Iteration: an iterable inside `Some`/`Ok` can be looped directly; `None`/`Err` yield an empty iterator.
  - `match(value, { Some, None, Ok, Err, _ })` with nested patterns and `_` default (throws "exhausted" if nothing matches and there is no default); chain form uses `[condition, result]` pairs with array/object patterns, `_` wildcards and predicate functions; `match.compile(patterns)` builds a reusable matcher.
- Caveats from the README: conversions often produce `Result<T, null>` — use `Option` or `mapErr` to get a useful error type; `safe` rejects Promise-returning functions at the type level (`Result<Promise<T>, Error>` is usually a mistake); iterating a non-iterable inner type (except `any`) or a known `None`/`Err` is a compile error; example annotations are illustrative, inference does the work.
- Why the README cites it: the project returns `Err(new UserAlreadyExistsError())` from command handlers and `match`es in HTTP controllers (409/400) while CLI controllers just `.unwrap()`.

## @badrap/result — npm — https://www.npmjs.com/package/@badrap/result
- Cited by README at line 812 in section "Domain Errors" to support: an alternative Result library.
- Fetch status: npm page returned HTTP 403; the README was read from github.com/badrap/result.
- What it does: a small TypeScript result type taking cues from Rust's `Result` and Haskell's `Either`; `Result<T, E extends Error = Error>` is a union of `Result.Ok<T,E>` (`.value`) and `Result.Err<T,E>` (`.error`); errors must extend `Error`.
- Philosophy: idiomatic, small API; "coding errors should throw" — `map`/`chain` do not catch exceptions thrown inside callbacks, unlike `Promise#then`; inference keeps common cases simple and type-safe.
- API (TypeScript): `Result.ok(v)`, `Result.err(e)` (defaults to `new Error()`); readonly `isOk`/`isErr` for narrowing; `unwrap(onOk?, onErr?)` (throws on Err with no handler; handlers may return different types); `map(onOk, onErr?)` returns a new Result; `chain(onOk, onErr?)` where callbacks return a Result that is flattened; `Result.all(arrayOrObject)` returns the first error or the combined values with the same shape (array → array, object → object).
- Caveats: no Promise helpers, no version or bundle-size claims on the page; MIT.

## Flexible Error Handling w/ the Result Class — Khalil Stemmler — https://khalilstemmler.com/articles/enterprise-typescript-nodejs/handling-errors-result-class/
- Cited by README at line 824 in section "Domain Errors" to support: returning explicit Result objects from domain/application code instead of throwing.
- Fetch status: fetched.
- What it argues: throwing for expected failures (e.g. invalid input when constructing a domain object) hurts readability, traceability and type safety; return an explicit `Result<T>` so the compiler makes callers handle expected edge cases; keep `throw` for unexpected errors and for library code.
- Recommendations and rules:
  - Do not catch creation errors inside the entity (no useful recovery there) and do not return `null` (callers expect a `User`).
  - Do not wrap every creation site in try/catch — doing that for a trivial operation is a code smell because it constrains all calling code.
  - Avoid `throw` for expected failures: not type-safe and breaks control flow (compared to GOTO).
  - Expose a static factory (`User.createUser(email, firstName, lastName): Result<User>`) with a private constructor; return `Result.fail<User>('Email is invalid')` or `Result.ok<User>(new User(...))`.
  - Callers check `isFailure`, return `error`, else `getValue()`.
  - `Result.combine(results)` validates several results at once and returns the first failure or an ok result; pair it with value objects (`Email`, `FirstName`, `LastName`) created individually and then combined before `User.create`.
  - Throw when writing library/tool code consumed by unknown callers (do not force Result on them); wrap callback APIs (Redis `client.get`) in Promises that reject on error.
  - Throw for unexpected errors you cannot handle — database connectivity, typos, null pointer errors (sometimes), out of memory — and cancel the operation (HTTP 500 for web requests, non-zero exit for scripts).
- Vocabulary: Result class; factory method; value object (validation can move there); adapter (wrapper over external APIs); `Result.combine`; `uncaughtException`; monads/Rx-style chaining as the heavier end of this approach.
- Examples (TypeScript): `Result<T>` with `isSuccess`, `isFailure`, `error: string`, private `_value`; private constructor that throws if success carries an error or failure lacks one, then `Object.freeze(this)`; `getValue()` throws on failure; static `ok<U>(value?)`, `fail<U>(error)`, `combine(results)`; controller usage `const userOrError = User.create(...)`; a Promise-wrapped Redis `getOne<T>(key)`.
- Trade-offs and caveats: Result is C#-derived and the author does not push it as mainstream; monads/Rx get challenging; `getValue()` still throws on misuse; `error` is a plain string, not a typed error; the article's validation condition is buggy and it mixes `User.create`/`createUser`.

## Advanced error handling techniques — Vladimir Khorikov (Enterprise Craftsmanship) — https://enterprisecraftsmanship.com/posts/advanced-error-handling-techniques/
- Cited by README at line 825 in section "Domain Errors" to support: typed errors with codes so callers can decide what to do with each.
- Fetch status: fetched. The post is specifically about distinguishing failure types (400 vs 404) with an explicit Error class; it does not cover Result vs exceptions in general.
- What it argues: when failures are plain strings, a controller cannot tell them apart and every failed `Result` becomes HTTP 400; introduce an explicit `Error` value object, carry it in `Result`, and convert to HTTP in a `BaseController`, keeping API concerns out of the domain.
- Recommendations and rules:
  - In most projects merge the application service into the controller; keep them separate mainly when decorators (e.g. CQRS handlers) are needed.
  - `Error` is a value object with `Code` and `Message`; `Code` is a string (meaningful descriptor) and is the identity — equality uses only `Code`, so messages can change freely; `Message` is debug info for developers; external systems bind only to codes, and codes must stay stable for backward compatibility.
  - Enumerate every application error in a static `Errors` catalog with optional categories (`Errors.Student.EmailIsTaken(email)`, `Errors.General.NotFound("Student", id)`), giving visibility into what can be returned.
  - Add a reflection-based test asserting all error codes are unique.
  - Services return `Result.Failure(Errors....)`; `BaseController.FromResult(result)` maps success → `Ok()`, `NotFound` code → 404 envelope, anything else → 400 envelope; do this in a base class, not a decorator, because the conversion is identical for every endpoint.
  - CSharpFunctionalExtensions lacked `Result<E>` at the time; use `Result<T,E>` or a custom Result.
- Vocabulary: Error (value object), Errors catalog, Result, Envelope, BaseController, application service vs controller, decorator (rejected for uniform conversion).
- Examples (C#): `sealed class Error : ValueObject { Code; Message; GetEqualityComponents() => Code }`; `new Error("student.email.is.taken", ...)`; uniqueness test via `typeof(Errors).GetMethods(...)` returning `Error`, invoked with default args, `Distinct().Count()`.
- Caveats: plain-string errors collapse all failures into one status; changing a code breaks clients; the sample's `FromResult` compares with a parameterless `NotFound()` that only works because equality ignores the message.
- How it applies to TypeScript/NestJS: the README's `ExceptionBase` with a `code` field and `user.errors.ts` catalog mirror this; the HTTP controller's `match` on error class is the `FromResult` equivalent.

## "Secure by Design" Chapter 9.2: Handling failures without exceptions — Johnsson, Deogun, Sawano (Manning liveBook) — https://livebook.manning.com/book/secure-by-design/chapter-9/51
- Cited by README at line 826 in section "Domain Errors" to support: modelling business failures as return values rather than exceptions.
- Fetch status: PARTIAL — only the chapter-9 opening and section headings are visible; section 9.2's body is paywalled.
- Visible content: chapter 9 "Handling failures securely" says failure handling and security go hand in hand; two cautions appear in the intro — if you signal errors with exceptions you must make sure they do not leak sensitive data, and ignoring cascading failures when integrating systems leaves a system fragile. Headings cover separating business exceptions from technical exceptions, handling failures without exceptions, resilience (circuit breakers, timeouts — always specify one — and bulkheads), and validation-related rules (do not repair data before validation; never echo input verbatim; second-order attacks; cross-site scripting).
- From model knowledge, not fetched (the section's substance as published): a business failure (insufficient funds, out of stock) is an expected outcome of a domain operation and is part of the domain's language, whereas a technical exception (connection lost) is not; model business failures as explicit return values/result types (or domain types with an outcome) so callers must handle them, and do not use exceptions for them; never intermix the two — do not let a technical exception carry business meaning and do not catch business failures as generic exceptions; exceptions crossing layers can expose internals, so technical failures are handled at the boundary with safe, generic messages.
- How it applies to TypeScript/NestJS: identical to the README's split — `Result`/`Err(...)` for business failures, thrown exceptions (converted by a global filter) for technical ones.

## "Functional Programming in Scala" Chapter 4: Handling errors without exceptions — Paul Chiusano & Rúnar Bjarnason (Manning liveBook) — https://livebook.manning.com/book/functional-programming-in-scala/chapter-4/
- Cited by README at line 827 in section "Domain Errors" to support: the functional-programming origin of returning errors as values.
- Fetch status: PARTIAL — only the chapter introduction and headings are visible.
- Visible content: exceptions are a side effect (per chapter 1); the functional alternative of returning errors as values is safer and keeps referential transparency while preserving the main benefit of exceptions, consolidation of error-handling logic; the chapter re-creates `Option` and `Either` to understand them and notes the standard-library versions lack some useful functions defined there; section 4.1 is "the good and bad aspects of exceptions".
- From model knowledge, not fetched (the chapter's substance as published): exceptions break referential transparency (the meaning of an expression depends on the try block it sits in) and are not tracked by types, so the compiler cannot force callers to handle them; `Option[A]` (`Some`/`None`) makes partial functions total; combinators `map`, `flatMap`, `getOrElse`, `orElse`, `filter`; `lift` turns `A => B` into `Option[A] => Option[B]`; `map2`, `sequence` and `traverse` combine many Options; `Try`-style helper converts a throwing expression into `Option`; `Either[E, A]` (`Left`/`Right`) carries information about the failure, with the same combinators; closing exercise points out that Either stops at the first error and asks how a type would accumulate errors (the idea behind Validated).
- How it applies to TypeScript/NestJS: `Option`/`Either` map to `Option`/`Result` in oxide.ts; `sequence`/`traverse` map to `Result.all`.

## Adapter — Refactoring.Guru — https://refactoring.guru/design-patterns/adapter
- Cited by README at line 840 in section "Using libraries inside Application's core" to support: wrapping a third-party library in an anti-corruption layer with the adapter pattern.
- Fetch status: fetched.
- What it defines: a structural pattern that lets objects with incompatible interfaces collaborate; the adapter implements the interface the client expects, wraps the service object, and translates each call (data format and call order); the wrapped object does not know the adapter exists; two-way adapters are possible.
- Problem/solution example: a stock-market app holds XML data and wants a JSON-only analytics library; XML-to-JSON adapters per analytics class let the app talk to the library only through adapters. Analogy: a power-plug adapter.
- Structure: object adapter (composition — client, client interface, service, adapter implementing the client interface and wrapping the service; client depends only on the interface so new adapters need no client changes) and class adapter (multiple inheritance, C++-only, inherits both client and service).
- Pseudocode: `RoundHole.fits(RoundPeg)` by radius; `SquarePegAdapter extends RoundPeg` wrapping a `SquarePeg` and reporting radius = width × √2 / 2.
- Applicability rules: use it when you need an existing class whose interface does not match your code (legacy, third-party, awkward) — the adapter is a translation layer that keeps the mismatch out of business logic; use it to reuse several subclasses lacking common functionality the superclass cannot provide, wrapping them and adding the feature dynamically (needs a common interface; resembles Decorator).
- Implementation steps: confirm two incompatible classes (a service you cannot change, one or more clients); declare the client interface; create the adapter class implementing it; give it a field holding the service (usually via constructor, sometimes per call); implement each method by delegating to the service and converting only interface/data; make clients use the adapter only through the client interface.
- Pros: Single Responsibility (conversion separated from business logic); Open/Closed (new adapters without breaking clients). Cons: more interfaces and classes raise complexity; sometimes changing the service class is simpler.
- Relations: Bridge is designed up front, Adapter retrofitted; Decorator keeps/extends the interface and composes recursively, Adapter changes it; Proxy keeps the interface; Facade defines a new interface over a whole subsystem while Adapter wraps one object; Bridge/State/Strategy share the composition structure but solve different problems.

## Facade — Refactoring.Guru — https://refactoring.guru/design-patterns/facade
- Cited by README at line 840 in section "Using libraries inside Application's core" to support: the facade as the other way to build an anti-corruption layer over a library.
- Fetch status: fetched.
- What it defines: a structural pattern providing a simplified interface to a library, framework or complex set of classes; it offers fewer features than the subsystem but only those clients need (an app uploading cat videos needs one `encode(filename, format)` over a professional conversion library). Analogy: a phone-order operator in front of ordering, payment and delivery systems.
- Problem: using a sophisticated library directly means initializing many objects, tracking dependencies and calling methods in the right order, which couples business logic to third-party details.
- Structure: Facade (knows which subsystem objects handle a request and coordinates them); Additional Facade (to stop one facade accumulating unrelated features); Complex Subsystem (dozens of objects that do not know the facade exists); Client.
- Pseudocode: `VideoConverter.convert(filename, format)` wrapping `VideoFile`, `CodecFactory`, `MPEG4`/`Ogg` codecs, `BitrateReader`, `AudioMixer`; if the framework is replaced only the facade changes; noted as a functionality-vs-simplicity trade-off.
- Applicability: a limited, straightforward interface to a complex subsystem (subsystems grow and so does the boilerplate clients need); structuring a subsystem into layers with one facade per layer as its entry point, layers talking only via facades (reduces coupling; resembles Mediator).
- Implementation steps: check you can offer a simpler interface (success = client code stops depending on many subsystem classes); declare/implement it in a facade that forwards calls and manages subsystem initialization and lifecycle; route all client code through the facade so a subsystem upgrade only touches the facade; if the facade grows into a Large Class, extract a more specialized facade.
- Pros: isolates code from subsystem complexity. Con: a facade can become a god object coupled to every class.
- Relations: Adapter makes an existing interface usable and wraps one object, Facade defines a new interface over a subsystem; Abstract Factory is an alternative when only creation must be hidden; Flyweight makes many small objects, Facade one object for a whole subsystem; Mediator centralizes communication (components know only the mediator) while a Facade adds no behaviour and subsystem objects still talk directly; a Facade is often a Singleton; Proxy keeps the service's interface (interchangeable), Facade does not.
- Note: the page offers code in C#, C++, Go, Java, PHP, Python, Ruby, Rust, Swift and TypeScript.

## Referencing external libs (Referencing external libraries from the domain model) — Vladimir Khorikov (khorikov.org, 2019) — https://khorikov.org/posts/2019-08-07-referencing-external-libs/
- Cited by README at line 852 in section "Using libraries inside Application's core" to support: when a library may be referenced from the core and when it must be kept out.
- Fetch status: fetched.
- What it argues: "don't reference third-party libraries from the domain model" is a heuristic, not a rule; it is a proxy for two real problems — referencing an out-of-process dependency, and exposing functionality irrelevant to the domain; referencing a package is not wrong in itself (the domain already uses integers and strings from the base library).
- Context: a reader's `AppUser : IdentityUser` (ASP.NET Core Identity) is used as an `Owner` property on another entity, pulling the Identity package into the Domain project.
- Rationale for domain isolation: testability (out-of-process dependencies force mocks, and mock overuse couples tests to implementation details) and offloading irrelevant responsibilities (business logic is complex enough).
- Rules:
  - Always separate business logic from communication with out-of-process dependencies.
  - Problem 1 — out-of-process access: a library that reaches external data (e.g. an HTTP call to an identity provider) breaks isolation; `IdentityUser` itself does not.
  - Problem 2 — irrelevant functionality: a framework type may expose things like a mutable `Claims` collection, polluting the model and breaching encapsulation (the domain should expose `Email`, possibly implemented over claims internally, and apply its own rules to changes); the example is explicitly speculative.
  - If both conditions apply, create a POCO `User` that does not inherit framework classes; where the framework hands you an `IdentityUser` per request, map it to `User` at the controller boundary; the domain works only with `User`.
  - Guiding principle: protect the domain from dilution — eliminate the irrelevant, amplify the essentials.
- Vocabulary: domain model isolation; out-of-process dependency; heuristic vs rule; encapsulation breach; POCO.
- Anti-patterns: using an ORM or other third-party types directly in the domain layer; HTTP/data access from the domain; exposing mutable framework collections; letting framework types leak into the model.
- Caveats: mapping at the boundary is an extra translation step (cost not discussed); the article does not give stability criteria, a core-part-of-your-domain test, or wrapping vs direct-reference guidance — those come from the README's own text.
- How it applies to TypeScript/NestJS: the README's rule list (no out-of-process access, nothing framework/ORM/logger-specific, no randomness, nothing that changes often) is this heuristic restated; NestJS decorators such as `@Inject()` are tolerated as non-intrusive.

## Anti-corruption Layer — An effective Shield — malotor (Medium) — https://medium.com/@malotor/anticorruption-layer-a-effective-shield-caa4d5ba548c
- Cited by README at line 853 in section "Using libraries inside Application's core" to support: building an anti-corruption layer around external libraries/systems.
- Fetch status: NOT FETCHED — Medium returned HTTP 403 on both attempts.
- What it argues (from model knowledge, not fetched; details unverified): an explanation of Eric Evans' Anticorruption Layer — an isolating layer placed between your bounded context and an external or legacy system so the other model's concepts do not leak into yours; it is typically built from a facade (simplifies the foreign system), adapters (translate interface) and translators (convert data/vocabulary), lives on your side of the boundary, and keeps the ubiquitous language of your context intact.
- Rules usually given (from model knowledge, not fetched): translate in both directions at the boundary; keep the ACL thin and specific to the integration; use it whenever the external model is poor, unstable or conceptually different, not for minor differences; it adds code and latency, so weigh the cost.

## OpenAPI/Swagger decorators — NestJS docs, OpenAPI "Operations" — https://docs.nestjs.com/openapi/operations
- Cited by README at line 867 in section "Controllers" to support: controllers as the place for OpenAPI/Swagger documentation decorators.
- Fetch status: fetched (current docs; some decorators the README's era used, such as `@ApiOperation`, `@ApiParam`, `@ApiQuery` and the security decorators, are documented on other pages).
- Decorators and rules (TypeScript):
  - `@ApiTags('cats')` on a controller attaches it to tags; `DocumentBuilder.addTag(name, description, undefined, { parent, kind, summary })` builds tag hierarchy/navigation — `parent`/`kind` are OpenAPI 3.2 fields, so call `setOpenAPIVersion('3.2.0')` or strict validators reject them; `@ApiTags()` ignores `parent`/`kind` and logs a warning.
  - `@ApiHeader({ name, description })` documents a custom request header (shown at controller level).
  - `@ApiResponse({ status, description, type? })` per method, repeatable; shorthand decorators for 2xx (`ApiOkResponse`, `ApiCreatedResponse`, `ApiAcceptedResponse`, `ApiNoContentResponse`), 3xx (`ApiMovedPermanentlyResponse`, `ApiFoundResponse`), 4xx (`ApiBadRequestResponse`, `ApiUnauthorizedResponse`, `ApiForbiddenResponse`, `ApiNotFoundResponse`, `ApiMethodNotAllowedResponse`, `ApiNotAcceptableResponse`, `ApiRequestTimeoutResponse`, `ApiConflictResponse`, `ApiGoneResponse`, `ApiPreconditionFailedResponse`, `ApiPayloadTooLargeResponse`, `ApiUnsupportedMediaTypeResponse`, `ApiUnprocessableEntityResponse`, `ApiTooManyRequestsResponse`), 5xx (`ApiInternalServerErrorResponse`, `ApiNotImplementedResponse`, `ApiBadGatewayResponse`, `ApiServiceUnavailableResponse`, `ApiGatewayTimeoutResponse`) and `ApiDefaultResponse`; `type: Cat` sets the response schema, and every property of `Cat` must carry `@ApiProperty()` to appear; `DocumentBuilder.addGlobalResponse({ status, description })` adds a response (typically 401/500) to all endpoints.
  - File upload: `@ApiConsumes('multipart/form-data')` + `@ApiBody({ description, type: FileUploadDto })` with `@ApiProperty({ type: 'string', format: 'binary' })` (or `type: 'array', items: {...}` for many files).
  - `@ApiExtension('x-foo', { hello: 'world' })` adds a vendor extension; the name must start with `x-` or the decorator throws.
  - Generic responses: leave the generic field undecorated (`results: TData[]`), then compose a raw schema with `allOf: [{ $ref: getSchemaPath(PaginatedDto) }, { properties: { results: { type: 'array', items: { $ref: getSchemaPath(CatDto) } } } }]`; register otherwise-unreferenced models with `@ApiExtraModels(PaginatedDto)` so SwaggerModule emits them; wrap this in a reusable `ApiPaginatedResponse(model)` built with `applyDecorators(ApiExtraModels(...), ApiOkResponse({...}))`; add `title: \`PaginatedResponseOf${model.name}\`` so client generators do not inline the type.
- Caveats: the sample body description for the single-file upload is inconsistent on the page; shorthand decorators imply the status code by name only.

## NestJS Controllers — NestJS docs — https://docs.nestjs.com/controllers
- Cited by README at line 871 in section "Controllers" to support: the HTTP controller as one trigger-type controller per use case.
- Fetch status: fetched (current docs, which include newer v12 options).
- Definition: controllers handle incoming requests and return responses; decorators attach metadata from which Nest builds the routing map; a controller usually has several routes.
- Routing rules: `@Controller('cats')` prefixes all routes; method decorators `@Get/@Post/@Put/@Delete/@Patch/@Options/@Head/@QueryMethod/@All`; method names are arbitrary; trailing `*` wildcard (`abcd/*`), Express 5 wants named wildcards (`{*splat}`), Fastify has no mid-route wildcards; `-` and `.` are literal; routes register in declaration order, so declare parameterized routes (`:id`) after static ones (`me`) — pipes cannot help because routing happens first; v12 adds `routeConflictPolicy` (`duplicate`/`shadow`: off|warn|error, aggregated into `RouteConflictException` at init) and `routeResolutionStrategy: 'specificity'` (literal before parametric before wildcard; no-op on Fastify, whose router already ranks); `@Param('id')` vs whole params object; sub-domain routing with `@Controller({ host: ':account.example.com' })` and `@HostParam('account')` (Express/Node adapters only).
- Request access: prefer dedicated decorators over `@Req()`: `@Param`, `@Body`, `@Query`, `@Headers`, `@Session`, `@Ip`, `@HostParam`, `@Cookies`/`@SignedCookies`, `@Next`; `@Body/@Query/@Param/@RawBody` accept `{ schema, pipes }` for Standard Schema libraries (Zod, Valibot, ArkType), but validation still needs `StandardSchemaValidationPipe` or a custom pipe reading `metadata.schema`.
- Response handling: standard mode serializes objects/arrays to JSON, primitives as-is, status 200 (201 for POST) — recommended because Nest manages the response and interceptors/decorators keep working; injecting `@Res()`/`@Next()` switches that route to library-specific mode where you must send the response yourself (otherwise the request hangs), code becomes platform-dependent, testing needs response mocks, and interceptors, `@HttpCode()` and `@Header()` stop applying; use `@Res({ passthrough: true })` to set cookies/headers while keeping framework handling.
- Other decorators: `@HttpCode(204)`; `@Header('Cache-Control', 'no-store')`; `@Redirect(url?, statusCode = 302)`, overridable by returning an `HttpRedirectResponse`-shaped object; dynamic status codes need the library response or an exception.
- Scope: nearly everything (DB pools, singleton services) is shared across requests, which is safe because Node is not thread-per-request; request-scoped providers exist for per-request caching, tracking, multi-tenancy.
- Async: handlers may return Promises or RxJS Observables (Nest resolves the last emitted value).
- DTO rule: declare request payloads as classes, not interfaces — interfaces are erased at compile time, and pipes need the runtime metatype; `ValidationPipe` with `whitelist` strips undeclared properties.
- Query parameters arrive as strings (`@Query('age') age: number` does not convert — use `ParseIntPipe`); nested/array query syntax needs the `qs` parser (`app.set('query parser', 'extended')` on Express, `querystringParser` on Fastify/Node adapters).
- Registration: controllers must be listed in a module's `controllers` array; CLI: `nest g controller [name]`, `nest g resource [name]` for CRUD; the full `CatsController` CRUD sample shows `@Post/@Get/@Get(':id')/@Put(':id')/@Delete(':id')` with `CreateCatDto`, `ListAllEntities`, `UpdateCatDto`.
- Page also promotes NestJS Observe (route-pattern metrics via `instrument: ObserveInstrument` and `ObserveModule.forRoot()`).

## NestJS Console (nestjs-console) — npm (Pop-Code) — https://www.npmjs.com/package/nestjs-console
- Cited by README at line 872 in section "Controllers" to support: a CLI controller (`create-user.cli.controller.ts`) as a second trigger type for the same use case.
- Fetch status: npm page returned HTTP 403; the package README and two wiki pages (Getting started, Using decorators) were read from GitHub.
- What it does: a NestJS module providing a CLI built on commander; it exposes a ready-to-use service so modules can register commands and subcommands bound to provider methods, running inside the Nest DI container. Motivation: Nest has no built-in CLI for accessing the application context (headless apps, cron tasks, data exports).
- How it works: a bootstrap entry point (`console.ts`) is run from the command line; it creates a headless `NestApplicationContext` (not an HTTP app); modules define commands via nestjs-console, which invokes commander, which parses and dispatches.
- Key API (TypeScript, from the wiki):
  - `console.ts`: `const bootstrap = new BootstrapConsole({ module: MyModule, useDecorators: true }); bootstrap.init().then(async app => { await app.init(); await bootstrap.boot(); await app.close(); })` with error handling that exits 1.
  - Import `ConsoleModule` in the module (`@Module({ imports: [ConsoleModule], providers: [MyService] })`); `ConsoleService` can then be injected anywhere for programmatic registration.
  - `@Console()` on a provider marks it for scanning; no options → commands at the CLI root; `@Console({ command: 'new', description })` → its `@Command`s become subcommands of `new` (another class with the same `command` joins the group); dotted `command: 'new.something'` nests a CLI under `new`.
  - `@Command({ command: 'list <directory>', description })` on an `async` method; `<name>` marks a required argument; handler parameters match the arguments (`listContent(directory: string)`).
  - Not seen on the fetched pages (documented on other wiki pages): `[optional]` args, `alias`, the `options` array (flags/description/required/defaultValue/fn), the handler signature with options, `ConsoleService` methods, spinner helpers, how to execute (ts-node vs compiled `dist`).
- Repository notes: MIT, ~579 stars, GitHub Actions tests, no deprecation notice visible (the project is low-activity; from model knowledge, not fetched: NestJS users today often use `nest-commander` instead).
- Why the README cites it: the CLI controller `.unwrap()`s the command result because exit codes, not HTTP statuses, matter there.

## NestJS Microservices — NestJS docs, Microservices "Overview" — https://docs.nestjs.com/microservices/basics
- Cited by README at line 873 in section "Controllers" to support: a message controller (`create-user.message.controller.ts`) as a third trigger type.
- Fetch status: fetched (current docs).
- Concepts: a Nest microservice is an app using a non-HTTP transport; DI, decorators, filters, pipes, guards and interceptors work unchanged; transporters (TCP default, Redis, MQTT, NATS, RabbitMQ, Kafka, gRPC, custom) support request-response and event styles behind one interface, so transports can be swapped without changing handlers.
- Bootstrap: `NestFactory.createMicroservice<MicroserviceOptions>(AppModule, { transport: Transport.TCP, options })`, then `app.listen()`; TCP options: `host`, `port`, `retryAttempts` (default 0), `retryDelay` (0), `serializer`/`deserializer`, `socketClass` (default `JsonSocket`), `tlsOptions`, `maxBufferSize`, `incompleteMessageTimeout` (30000 ms), `maxSendBufferSize` (128 MB); dynamic options via `AsyncMicroserviceOptions` with `useFactory`/`inject` (ConfigService) because plain options are read before providers exist.
- Patterns: messages are routed by patterns (strings or object literals) serialized with the payload.
- Request-response: `@MessagePattern({ cmd: 'sum' })` on a controller method (ignored in providers); use when the caller needs a reply or delivery confirmation; Nest creates two logical channels (native in NATS, manual elsewhere, adding overhead); handlers may be sync, async or return Observables (each emission is a response).
- Event-based: `@EventPattern('user_created')` for fire-and-forget; avoids the two-channel overhead; several handlers for one event run in parallel; log-based platforms (Kafka, NATS JetStream) fit events better.
- Handler arguments: payload by default; `@Payload()`/`@Payload('id')` (pipes apply); `@Ctx()` for transport context (e.g. `NatsContext.getSubject()`, Kafka headers); `@Bind(Payload(), Ctx())` method form.
- Client: `ClientsModule.register([{ name: 'MATH_SERVICE', transport: Transport.TCP }])` or `registerAsync`; inject `@Inject('MATH_SERVICE') client: ClientProxy`; alternatives `ClientProxyFactory.create()` in a factory provider, or the `@Client()` property decorator (not preferred: harder to test/share); the proxy connects lazily on first call — call `connect()` in `onApplicationBootstrap()` to fail fast; `send(pattern, payload)` returns a cold Observable (nothing is sent until subscribed) and pairs with `@MessagePattern`; `emit(pattern, payload)` returns a hot Observable (sent immediately) and pairs with `@EventPattern`; timeouts via RxJS `timeout(5000)` (errors with `TimeoutError`).
- Status/events: `client.status.subscribe(...)` / server `status`; `client.on('error', ...)`; `unwrap<T>()` exposes the driver but is discouraged.
- Request scoping: `@Injectable({ scope: Scope.REQUEST })` with `@Inject(CONTEXT) ctx: RequestContext` (`pattern`, `data`, `context`).
- TLS: server `tlsOptions: { key, cert }`, client `tlsOptions: { ca: [...] }`; recommended when traffic leaves a private network.
- Caveats: request-response costs more on transports without native dual channels; TCP `on()` listeners persist across reconnects (v12.1.1+) and are not deduplicated; retries default to 0; error handling is on the exception-filters page.

## GraphQL — graphql.org — https://graphql.org/
- Cited by README at line 878 in section "Resolvers" to support: GraphQL as an alternative user-facing API to REST controllers, with only the interface-adapter layer changing.
- Fetch status: fetched.
- What it defines: an open-source query language for APIs plus a server-side runtime; a strongly typed schema describes the data and its relationships; it is not tied to any database or storage engine and works with existing code and data; maintained by the GraphQL Foundation under the Linux Foundation (since 2018), spec open-sourced in 2015, used in Facebook's mobile apps since 2012.
- Claims/benefits listed: ask for exactly the fields you need (no over-/under-fetching, predictable responses); fetch many related resources in one request by following relationships instead of calling multiple URLs; a type system that is self-documenting and lets tools validate queries before execution; evolve without versioning by adding fields/types and marking old ones `@deprecated`; bring your own data and code — unify databases, REST APIs and third-party services in one data layer; tooling such as GraphiQL and editor code intelligence.
- Example shown: `query getCity($city: String) { cities(name: $city) { population weather { temperature precipitation } } }` returning `{ "data": { "cities": [ { "population": 8675309, "weather": { "temperature": 22.5, "precipitation": 1.2 } } ] } }`.

## Resolvers — NestJS docs, GraphQL "Resolvers" — https://docs.nestjs.com/graphql/resolvers
- Cited by README at line 878 in section "Resolvers" to support: using resolvers instead of controllers when the API is GraphQL (example `create-user.graphql-resolver.ts`).
- Fetch status: fetched (current docs).
- Approaches: code-first (SDL generated from TypeScript classes/decorators) vs schema-first (hand-written `.graphql` SDL aggregated at run time, with TypeScript typings generated from it); the resolver map is generated from decorator metadata.
- Code-first object types: `@ObjectType({ description?, deprecationReason?, registerIn? })` with `@Field()`; fields are non-nullable by default; `string`/`boolean` need no type function, `number` needs `() => Int` or `() => Float` (default Float); arrays need `() => [Post]`, with `nullable: 'items' | 'itemsAndList'`; nested brackets express `[[Int]]`; `registerIn: () => Module` scopes a type to one endpoint; reflection cannot see optionality/array element types, so use `@Field()` options or the CLI plugin.
- Resolver decorators: `@Resolver(() => Author)` (required when the class has `@ResolveField`), `@Query(() => Author, { name, description, deprecationReason, nullable })`, `@Mutation` (other page), `@ResolveField('posts', () => [Post])` with `@Parent()`, plus `@Root()`, `@Context(key?)`, `@Info(key?)`; `@Args(name?, { type, defaultValue, description, deprecationReason, nullable })`; method names are the default GraphQL names, `{ name }` decouples them (`getAuthor` exposed as `author`); multiple query resolvers merge into one `Query` type.
- Args classes: `@ArgsType()` class with `@Field()` and class-validator decorators (`@MinLength(3)`), consumed as `@Args() args: GetAuthorArgs` and validated by `ValidationPipe`; nullable args still need null guards in the resolver.
- Inheritance/generics: shared base `@ArgsType()`/`@ObjectType()` classes (offset/limit); abstract resolver factories with `@Resolver({ isAbstract: true })` (suppresses SDL output); a `Paginated<T>(classRef)` factory producing edge/node/cursor types, e.g. `class PaginatedAuthor extends Paginated(Author) {}`.
- Schema-first: `@Resolver('Author')`, `@Query('author')`, `@ResolveField('posts')`; method-level `@Resolver` is possible but not recommended and unsupported in code-first; generated typings (`outputAs: 'class'`) land in e.g. `src/graphql.ts` — extend the generated classes in separate files rather than editing them, since regeneration overwrites.
- Registration: resolvers are providers listed in a module's `providers`; organize models, resolvers and services per domain module; the CLI can scaffold.
- Rules with reasoning: explicit type functions for numbers (avoid silent Float); args classes over long inline `@Args` lists (readability, shared validation); guard nullable inputs; pick code-first for one TypeScript source of truth and refactoring, schema-first when the SDL is a contract shared with other teams/languages.

## REST (Representational state transfer) — Wikipedia — https://en.wikipedia.org/wiki/Representational_state_transfer
- Cited by README at line 880 in section "Resolvers" to support: REST vs GraphQL only changes the interface-adapter layer.
- Fetch status: fetched.
- Definition: a software architectural style created to describe and guide the architecture of the Web, defining constraints for a distributed, Internet-scale hypermedia system; defined by Roy Fielding in his 2000 UC Irvine dissertation after he co-authored the URI and HTTP 1.0/1.1 standards and used REST to evaluate proposed Web extensions.
- Core principle: the server returns a representation of a resource containing hypermedia links; the client needs to know only the first identifier and discovers the rest through links, so identifiers can change and client/server stay loosely coupled.
- Properties REST aims for: performance of component interactions, scalability, simplicity of a uniform interface, modifiability (even at run time), visibility of communication to intermediaries, portability of code with data, reliability; Fielding's goals also list extensibility, independent deployment, large-grain data transfer and a low entry barrier.
- The six constraints: client-server (separated by a well-defined interface); stateless (no server storage consumed by a client at rest); cache (responses declare cacheability); uniform interface; layered system (a client cannot tell whether it talks to the end server or an intermediary); code on demand (optional — servers can ship executable logic to clients).
- Uniform-interface sub-constraints: resource identification in requests (URIs; resources are distinct from their HTML/XML/JSON representations); resource manipulation through representations (a representation plus metadata suffices to modify or delete); self-descriptive messages (media types say how to process them); HATEOAS (the client starts at one URI and navigates server-provided links, needing no hard-coded knowledge of the server's structure).
- Mismatches Fielding cited in the real Web: session information in URIs (hurts shared caching and scalability) and HTTP cookies (fall out of sync with application state, unreliable, opaque data with privacy/security concerns).
- "RESTful" in practice: the term is mostly attached to HTTP API design and "which verbs a resource responds to", which the article says has little to do with REST as formulated and is often at odds with it; maturity models for HTTP APIs: Richardson Maturity Model, Algermissen's classification, the W S3 maturity model (Salvadori & Siqueira).
- Caveats: no dedicated criticism section; REST vs RPC and the Richardson levels are not described.

## Data transfer object — Wikipedia — https://en.wikipedia.org/wiki/Data_transfer_object
- Cited by README at line 890 in section "DTOs" to support: representing data from external applications with DTOs that define the API contract.
- Fetch status: fetched.
- Definition: an object that carries data between processes; motivated by expensive remote calls (web services) whose cost is mostly round-trip time, so one DTO aggregates what would otherwise take several calls.
- Distinction: a DTO has no behaviour beyond storing, retrieving, serializing and deserializing its own data (accessors, mutators, serializers, parsers only) and should contain no business logic; business objects and data access objects carry behaviour.
- Origin/terminology: from Martin Fowler's Patterns of Enterprise Application Architecture (also an MSDN article); the Sun/Java community once conflated "value object" with DTO — a value object is not a DTO; the pattern is often misapplied outside remote interfaces, to which Fowler responded with "LocalDTO".
- Implementation note: in some languages DTOs are records or structs; the page's Java example is a `UserResponseDTO` record (`id`, `@NotBlank name`, `@Email email`) built from a properties file (the snippet has a syntax slip).
- Caveats: the page is a stub; "See also" lists anti-pattern and architectural pattern; sits with DAO, Active Record and multitier architecture in the design-patterns navbox.

## Are CQRS commands part of the domain model? — Vladimir Khorikov (Enterprise Craftsmanship) — https://enterprisecraftsmanship.com/posts/cqrs-commands-part-domain-model/
- Cited by README at line 924 in section "Response DTOs" to support: the README's blockquote that commands are serializable method calls while DTOs are data contracts kept separate for backward compatibility (the "Commands vs DTOs" section).
- Fetch status: fetched.
- What it argues: yes — commands are part of the core domain model, as are domain events; they are "two ends of the same stick" at the same onion-architecture level: a command triggers a reaction in the domain, an event is the result; queries are left out of the diagram because only writes need a rich, encapsulated model.
- Definitions: commands follow the push model (raised by an external party) and represent what clients can do; events follow the pull model (raised by the application) and represent outcomes; commands are serializable method calls into the domain model; DTOs are data contracts whose main purpose is backward compatibility for API clients; pure vs impure domain services (the latter touch the database/file system).
- Rules and reasoning:
  - Always map DTOs to commands explicitly; the hesitation to call commands "domain" comes from using them as request payloads, i.e. as data containers.
  - Reusing a command as the DTO forces a choice between breaking the API on every domain change and freezing the domain to keep compatibility; it is less harmful than exposing entities as DTOs (commands hold no logic) but still blocks refactoring — e.g. splitting a student's name into first/last would require keeping and processing two command versions.
  - Two layers are cleaner: DTOs can have as many versions as needed while commands stay domain-focused; mapping between them is cheaper than merging both responsibilities.
  - Commands may double as DTOs only when backward compatibility is unnecessary: UI and backend in one process (desktop app), or you control both API and clients and deploy them together; treat this as an edge-case optimization; public APIs or independently deployed clients need both.
- Examples (C#): anti-pattern `EditPersonalInfo([FromBody] EditPersonalInfoCommand command)` passed straight to `new EditPersonalInfoCommandHandler(_unitOfWork).Handle(command)`; recommended `EditPersonalInfo([FromBody] StudentPersonalInfoDto dto)` building `new EditPersonalInfoCommand { Email = dto.Email, Name = dto.Name, Id = id }` first; handlers return `Result`, controller returns `Ok()` or `Error(result.Error)`.
- Not covered: where command validation happens, command handlers as application services, ubiquitous language.
- How it applies to TypeScript/NestJS: the README keeps `create-user.request.dto.ts` and `create-user.command.ts` separate with identical properties for exactly this reason.

## class-sanitizer — npm (typestack) — https://www.npmjs.com/package/class-sanitizer
- Cited by README at line 931 in section "Additional recommendations" to support: sanitization decorators on request/response DTOs.
- Fetch status: npm page returned HTTP 403; the README was read from github.com/typestack/class-sanitizer.
- What it does: decorator-based sanitization of class properties in TypeScript, built on validator.js; `sanitize(instance)` applies the decorators in place; a `Sanitizer` default export offers non-decorator helpers (`Sanitizer.trim()`).
- Status: the README declares the library deprecated and unmaintained; the repository was archived read-only on 1 Aug 2020; it points users to class-transformer and/or class-validator instead.
- Decorators (property-level only): `@Trim(chars?)`, `@Ltrim`, `@Rtrim`, `@Blacklist(chars)`, `@Whitelist(chars)`, `@Escape()` (HTML entities), `@NormalizeEmail(lowercase?)`, `@StripLow(keepNewLines?)`, `@ToBoolean(isStrict?)`, `@ToDate()`, `@ToFloat()`, `@ToInt(radix?)`, `@ToString()`, `@SanitizeNested({ each })`, `@Sanitize(CustomClass)`; `{ each: true }` applies a decorator to every array element.
- Custom sanitizers: a class decorated with `@SanitizerConstraint()` implementing `CustomSanitizer` whose synchronous `sanitize(text)` returns the transformed value; optional TypeDI injection.
- Example (TypeScript): `class Post { @Trim() title; @Trim(undefined, { each: true }) tags: string[]; @Escape() body; @SanitizeNested({ each: true }) comments: Inner[] }` then `sanitize(post)`.
- Caveats: inheritance works one level only (grandparent decorators are not applied); no parameter/class decorators; deprecated — the README's advice to use it should be read as a pointer to class-transformer transforms instead.

## Notification — Martin Fowler (martinfowler.com, 2004 draft) — https://martinfowler.com/eaaDev/Notification.html
- Cited by README at line 931 in section "Additional recommendations" to support: gather all validation errors first and return them together (class-validator does this by default).
- Fetch status: fetched.
- Intent: an object that collects errors and other information in the domain layer and carries them to the presentation.
- Problem: under Separated Presentation the domain cannot call the presentation; exceptions report only the first failure, while users want every validation error at once — especially when validation requires a remote round trip; raising a domain event per error works badly with remote domains because each event is a network call.
- How it works:
  - Simplest form is a list of error message strings; better, a class with methods that add errors by code and a `HasErrors` check.
  - Errors carry codes so the presentation can map them to fields and display them interactively; codes are shared between domain and presentation and should use the domain's vocabulary.
  - Warnings and informational messages may share the object but are kept separate from errors.
  - Attach the notification to a Data Transfer Object through a Layer Supertype so every interaction carries one; Transaction Script logic can reference it directly, while a Domain Model usually cannot see DTOs, so the notification goes into a session-like object the domain can reach.
  - Across process boundaries the notification must contain only serializable data (no domain object references); error IDs may be needed so errors compare after serialization.
  - The presentation checks the notification after the call and displays the errors; the domain could throw instead, but Fowler prefers not to because validation errors are common (a mild preference, not an absolute).
  - Wrap command objects behind a Service Layer method, exposed through a Remote Facade.
- Sample (C#): `ClaimService.RegisterClaim(dto)` runs a `RegisterClaim` command; `DataTransferObject` holds a `Notification` of `Error` objects with `HasErrors`; `Run()` calls `Validate()` and registers only when there are no errors; `Validate()` checks policy number, incident type and date present, policy exists, incident date not before policy inception, with dependent checks returning early; helpers `isNullOrBlank`, `failIfNullOrBlank`, `fail` in the supertype; error constants as static fields on the DTO; the WinForms client maps errors to controls with an `ErrorProvider` and clears them on edit.
- When to use: when validation runs in a layer the caller cannot depend on directly (typical layered designs with Separated Presentation); exceptions are the alternative but report one error; events allow several but suit remote domains poorly.
- Caveats: a mid-2000s draft Fowler will not update; the sample has a duplicated `DATE_BEFORE_POLICY_START` check and an undefined `IncludesError`; long validate methods with interdependent checks should be split.

## NestJS provides (OpenAPI "Types and parameters") — NestJS docs — https://docs.nestjs.com/openapi/types-and-parameters
- Cited by README at line 932 in section "Additional recommendations" to support: Swagger/OpenAPI decorators on request/response DTO classes.
- Fetch status: fetched (current docs; `@ApiHideProperty`, `nullable`, `deprecated`, `maximum`, `name` and the mapped types `PartialType/PickType/OmitType/IntersectionType` live on other pages and were not on this one).
- Mechanism: `SwaggerModule` scans `@Body()`, `@Query()`, `@Param()`, `@Headers()` and uses reflection to build model definitions; a DTO without `@ApiProperty()` on its properties yields an empty schema; `@ApiBody({ type: CreateCatDto })` sets the body explicitly; the CLI plugin adds the annotations automatically and also detects arrays and circular dependencies.
- `@ApiProperty` options shown: `description`, `minimum`, `default`, `type`, `required`, `enum`, `enumName`, `example`, `examples`, `oneOf`, `items`, `properties`, `isArray`; `@ApiPropertyOptional()` = `@ApiProperty({ required: false })`.
- Rules (TypeScript):
  - Arrays: `@ApiProperty({ type: [String] })` or `{ type: String, isArray: true }` — element types must be set manually (unless the plugin is used).
  - Circular dependencies: lazy type function `@ApiProperty({ type: () => Node })`.
  - Generics/interfaces: TypeScript stores no metadata for them, so `@ApiBody({ type: [CreateUserDto] })` must be stated for `CreateUserDto[]`.
  - Enums: inline `enum: [...]` or a TS enum; `@ApiQuery({ name: 'role', enum: UserRole, isArray: true })` for multi-select; `enumName: 'CatBreed'` turns the enum into a reusable `$ref` under `components/schemas` — without it, generators such as NSwag emit duplicate enums per usage.
  - Examples: `example: 'persian'` or `examples: { Persian: { value: 'persian' }, ... }`.
  - Raw definitions for matrices/nested structures: `{ type: 'array', items: { type: 'array', items: { type: 'number' } } }`, or `{ type: 'object', properties: {...}, required: [...] }`; also usable in `@ApiBody({ schema })`.
  - Extra models not referenced by any controller: `@ApiExtraModels(ExtraModel)` on a class or `extraModels: [...]` in `createDocument`; reference with `{ $ref: getSchemaPath(ExtraModel) }`.
  - Polymorphism: `oneOf: [{ $ref: getSchemaPath(Cat) }, { $ref: getSchemaPath(Dog) }]` (and inside `items` for arrays); each model must be registered via `@ApiExtraModels`; `anyOf`/`allOf` are named without examples.
  - `@ApiSchema({ name: 'CreateCatRequest', description })` renames/describes a schema (no description by default).

## LocalDTO — Martin Fowler bliki (2004) — https://martinfowler.com/bliki/LocalDTO.html
- Cited by README at line 940 in section "Local DTOs" to support: not using DTOs between controllers and domain inside one process (the README quotes his verdict that the data mapping is not worth the cost).
- Fetch status: fetched.
- What it argues: DTOs are not inherently bad, but their purpose is shifting data across expensive remote calls as part of a coarse-grained interface; Fowler admits he only discussed them in that context, which led readers to apply them locally.
- Rules and reasoning:
  - Within a single process DTOs are harmful, not just unnecessary: coarse-grained APIs are harder to use and you must write the code that moves data between domain/data-source objects and DTOs.
  - Using DTOs in a Service Layer API so clients do not depend on the Domain Model is "handy" but not worth the mapping cost; Randy Stafford (PoEAA) is cited that the cost is significant and painful, second only to O/R mapping.
  - Do not add DTOs speculatively in case the system is distributed later (his First Law of Distributed Object Design: don't distribute); start with a locally invocable Service Layer whose signatures use domain objects and add Remote Facades or remote interfaces only when needed.
  - Local DTO-like objects are justified when a screen's presentation model differs substantially from the domain model: build a presentation-specific facade/gateway that maps from the domain (Presentation Model pattern), only for the screens that need it, where the mapping would be needed anyway.
  - Update (Thibaut Barrère): DTOs are also useful as messages between isolated single-threaded areas of a multithreaded application that communicate through queues.
- Caveats: a pattern's value depends on context — knowing when not to use it matters as much as how; the README notes module-to-module queries are a case where local DTOs are justified to avoid leaking entities between modules.

## Anti-Corruption Layer: How to Keep Legacy Support from Breaking New Systems — Brian Nash, CloudBees blog (2019) — https://www.cloudbees.com/blog/anti-corruption-layer-how-keep-legacy-support-breaking-new-systems
- Cited by README at line 963 in section "Adapters" to support: adapters as an Anti-Corruption Layer for legacy code.
- Fetch status: fetched.
- What it argues: connecting legacy systems to new ones pulls their outdated protocols, data models, schemas and obsolete APIs into a clean design; an ACL — attributed to Eric Evans' DDD — is a separate, compartmentalized integration point that translates requests between old and new so the new system's internals stay unchanged; the article applies it to "continuous everything" pipelines (second in a Gang-of-Four-style pattern series).
- Applicability rules with reasoning:
  - Legacy cannot be cleanly retired (tribal knowledge, separation anxiety; big-bang re-architecture often yields "a big bang and nothing else"), so the business reasonably extends its life.
  - Integration cannot be avoided — avoid intense, risky integrations unless technical or political reasons require them, and keep probing because artificial requirements are common.
  - Conforming to the legacy model is not an option — assess the legacy system without bias (it may be acceptable); if modernizing, the ACL holds old and new together during a total or partial migration until cutover.
  - Semantic differences are significant — an ACL is overkill for minor differences, but major ones let corruption creep in.
- Scenarios: source control moving from on-premise to GitHub/AWS CodeCommit; dashboards moving from on-premise ELK to Sumo Logic/CloudWatch; artifact repositories moving between Nexus, Artifactory and S3 — pipelines should keep working through the migration.
- Design guidance: treat the ACL as a key system component — configure, release and monitor it like any application; legacy may be internal or external (*aaS vendors you have little control over); the ACL sits between the subsystems; related patterns named: Strangler, Facade, Adapter.
- Trade-offs/anti-patterns: higher total cost of ownership (maintenance); added network latency; it is temporary (unlikely to keep both old system and ACL long-term); over-investing in an ACL that is thrown away — monitor ROI; over-engineering for minor differences; unexamined bias against legacy; big-bang rewrites.
- Gaps: no code; no detail on bidirectional translation or building the ACL from facades/adapters/translators.

## Should you Abstract the Database? — Vladimir Khorikov (Enterprise Craftsmanship, 2021) — https://enterprisecraftsmanship.com/posts/should-you-abstract-database/
- Cited by README at line 987 in section "Repositories" to support: the note that abstracting the database behind interfaces is often not useful in practice and prevents using the database's full potential.
- Fetch status: fetched.
- What it argues: abstracting the database to enable a future DBMS switch is an anti-pattern ("the false myth of abstracting the database"); the benefit (easy switching) is visible, the cost (building and maintaining the abstraction for the project's whole life) is hidden and usually larger; separation of concerns is always worthwhile but does not require a database abstraction layer.
- Rules and reasoning:
  - Judge every decision by both its seen and unseen consequences; ignoring unintended consequences is ignorance or self-deception.
  - The abstraction (e.g. an `IDataAccess` interface with one implementation per DBMS) is not a one-off: it must be maintained for the project's duration even if no switch ever happens; a team bragging about a two-day switch ignores the weeks the abstraction cost.
  - An abstraction limits you to the lowest common denominator of relational databases, so you cannot use your DBMS's advanced features.
  - Apply YAGNI: work with the current database as if you will never switch; if a switch becomes necessary, treat it as porting the whole application, not as adding another implementation.
  - The real enabler of a safe port is a quality integration test suite that does not mock the database; the author reports seamless, bug-free switches with such suites.
  - Separation of concerns means not entangling domain logic with persistence logic; it does not mean adding layers in anticipation of a switch; the tweet that prompted the post (an Oracle→DB2 switch done by Friday thanks to separation of concerns) conflates the two.
- Vocabulary: seen vs unseen; vendor lock-in; lowest common denominator; porting; YAGNI; separation of concerns; integration tests (no DB mocks).
- Examples: no code; the `IDataAccess` interface is named only; related reading: the author's "YAGNI revisited" and Oren Eini's "The false myth of encapsulating data access in the DAL".
- Trade-offs/anti-patterns: database abstraction for switching; hidden maintenance cost; restricted features; mocked-database tests give false safety; over-abstraction beyond separation of concerns.
- Not covered: repositories/generic repositories, the ORM-is-already-an-abstraction argument, unit-test-motivated abstractions, leaky abstractions, hexagonal viewpoint.
- How it applies to TypeScript/NestJS: the README's generic `RepositoryPort` is kept as a practical example, with the explicit warning to think before abstracting; raw SQL via Slonik is its choice for using Postgres fully.

## Design the infrastructure persistence layer — Microsoft .NET Microservices architecture guide (learn.microsoft.com) — https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design
- Cited by README at line 995 in section "Repositories" to support: the repository pattern as the intermediary between domain and data mapping (the README's Fowler quote at 977-979 is taken from this page).
- Fetch status: fetched (redirects to learn.microsoft.com; the "Additional resources" link list at the end was not present in the extracted text).
- What it argues: data persistence components give access to the data inside a microservice's boundary and implement repositories and Unit of Work classes (an EF `DbContext` implements both patterns); the Repository pattern is a DDD pattern that keeps persistence concerns out of the domain model via abstractions (interfaces) defined in the domain model and implemented by persistence-specific adapters elsewhere.
- Rules and reasoning:
  - Repository implementations encapsulate data-access logic, centralize common data-access functionality, improve maintainability and decouple the database technology from the domain; with an ORM (EF + LINQ) the code is simplified.
  - Define one repository per aggregate/aggregate root (generics can reduce the number of concrete classes); in a DDD microservice the repositories must be the only channel for updating the database because they map one-to-one to the aggregate root that controls invariants and transactional consistency; never create a repository per table.
  - Queries may bypass repositories (CQRS): side queries with plain SQL via Dapper are more flexible because they can join any tables and are not restricted by aggregate rules; that data goes straight to the presentation layer/client.
  - Write flow: a command handler uses the repository to load the aggregate, changes it in memory with the command's data, then adds/updates it through a transaction.
  - Enforce "only aggregate roots have repositories" with a generic base interface constrained by a marker: `public interface IRepository<T> where T : IAggregateRoot {}`; each specific interface extends it (`IOrderRepository : IRepository<Order> { Order Add(Order order); }`) and is implemented in the infrastructure layer (`OrderRepository : IOrderRepository`).
  - Testability: place repository interfaces in the domain layer so the application layer (Web API) does not depend on infrastructure; with DI you can inject mock repositories returning fake data, so unit tests of application/domain logic need no database; database tests are integration tests — slower, and parallel runs can see each other's data — so have many fast unit tests and fewer integration tests; unit tests operate on in-memory domain entities and assume the repository delivered and will store them.
  - eShopOnContainers repositories rely on EF Core's DbContext change tracker for Repository/Unit of Work behaviour and do not duplicate it.
  - Repository vs legacy DAL class: a DAL object performs data access directly, often per table and row, frequently without transactions and with minimal abstraction, coupling BLL classes tightly; a repository abstraction hides persistence details and allows Decorators/Proxies for cross-cutting concerns (caching, logging, error handling) and multiple adapters per environment.
  - Unit of Work: one transaction grouping multiple inserts/updates/deletes for a user action (e.g. registration); changes are applied later in a single action when the application layer commands it; in EF it is `DbContext.SaveChanges`; it improves performance, reduces inconsistencies and table blocking by committing one transaction instead of many chatty ones; can be implemented with or without repositories.
  - Repositories are not mandatory: useful (the ordering microservice uses custom repositories) but not essential to DDD; Jimmy Bogard's feedback is quoted — he dislikes repositories because they hide the persistence mechanism, prefers MediatR commands using the full persistence layer with behaviour in aggregate roots, does not mock repositories (integration tests with the real thing), and found CQRS removed the need for them; the Aggregate pattern and a rich domain model matter more.
- Vocabulary: Repository pattern; Unit of Work; aggregate root; `IAggregateRoot` marker interface; DAL class; CQS/CQRS side queries; Decorator/Proxy for cross-cutting concerns.
- Examples (C#): `IRepository<T> where T : IAggregateRoot`; `IOrderRepository`/`IBuyerRepository` implemented in `Ordering.Infrastructure.Repositories`; Figure 7-17 (Buyer/Order aggregates → repository interfaces → infrastructure repositories → UnitOfWork → tables).
- Trade-offs/caveats: repositories hide persistence details (Bogard); hundreds of DB-backed tests are slow and flaky; generic repositories are acceptable only as a base constrained to aggregate roots.
- How it applies to TypeScript/NestJS: the README's `RepositoryPort` + `SqlRepositoryBase` + per-aggregate `UserRepository` follow this; query handlers may use raw SQL directly instead of repositories.

## Object–relational mapping — Wikipedia — https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping
- Cited by README at line 1007 in section "Persistence models" to support: ORM models as a separate persistence-layer model, distinct from domain entities.
- Fetch status: fetched.
- Definition: a programming technique for converting data between a relational database and the memory of an object-oriented program, creating a "virtual object database" usable from the language.
- The mismatch (overview): objects combine scalars and references (a `Person` with name, a list of `PhoneNumber` objects, addresses) while relational databases hold scalars in tuples/tables; differences in lifecycle (row insert/delete vs garbage collection), references (object references vs foreign keys), inheritance (absent in relational databases) and access (objects owned by one process vs shared tuples needing locking, merging, retry); objects that can be stored and reloaded are called persistent.
- Example: C# raw SQL `context.Persons.FromSqlRaw(sql)` vs ORM `repository.GetPerson(10)` / `person.GetFirstName()` or static `Person.Get(10)`; the paradigm is often chosen to fit the language's design.
- Advantages: usually less code than hand-written data access (a 1998 study: 496 lines with the ODMG Java binding vs 1,923 with JDBC).
- Disadvantages: stem from the high level of abstraction obscuring what the implementation actually does; ORMs are limited to predefined functionality that may miss edge cases or database features, so they offer raw-query escape hatches (Django's shown).
- Challenges: the object–relational impedance mismatch; alternatives are native database procedural languages called via SQL, abstracted behind the Data Access Object pattern.
- Comparison: OODBMSs store objects natively (no SQL conversion or join tables) but critics say they handle ad-hoc, application-independent queries poorly, so some replicate to SQL; document databases avoid shredding objects into rows, with object-document mappers (ODMs) and sometimes XQuery.
- Frameworks/patterns named: Hibernate, Django ORM, JDO, JPA/Jakarta Persistence, Service Data Objects, Entity Framework; Active Record, Data Mapper, Single Table Inheritance; links to list/comparison pages.
- Not in the article: the Vietnam-of-computer-science comparison, caching, performance, leaky abstraction by name.

## Database normalization — Wikipedia — https://en.wikipedia.org/wiki/Database_normalization
- Cited by README at line 1009 in section "Persistence models" to support: a normalization that spreads data across tables should not force a domain-layer refactoring if domain and persistence models are separate.
- Fetch status: fetched.
- Definition: structuring a relational database according to a series of normal forms to reduce redundancy and improve integrity, proposed by E. F. Codd with the relational model; done by synthesis (new design) or decomposition (existing design) so dependencies are enforced by integrity constraints.
- Objectives: Codd's 1NF (1970) aimed at querying via a first-order-logic sub-language (SQL, which Codd considered flawed); beyond 1NF: free relations from undesirable insertion/update/deletion dependencies; reduce restructuring when new data types are added (longer application life); make the model more informative; keep relations neutral to changing query statistics; a fully normalized database can be extended with minimal structural change.
- Anomalies: insertion (a new faculty member with no course cannot be recorded without a null course code); update (an address changed on some rows but not others); deletion (removing the last course record erases the faculty member).
- Normal forms: UNF; 1NF (1970: unique rows, scalar column values); 2NF (1971: every non-prime attribute depends on the whole of every candidate key); 3NF (1971: every non-trivial FD starts with a superkey or ends in a prime attribute); EKNF (1982: stricter 3NF, ends only in elementary prime attributes); BCNF (1974: every non-trivial FD starts with a superkey); 4NF (1977: every non-trivial multivalued dependency starts with a superkey); ETNF (2012: every join dependency has a superkey component); 5NF/PJNF (1979: every join dependency has only superkey components); DKNF (1981: every constraint follows from domain and key constraints); 6NF (2003: every join dependency is trivial — a row holds the key plus at most one other attribute).
- Target: a relation is informally "normalized" at 3NF, and most 3NF relations are anomaly-free; forms beyond 4NF are mainly academic because their problems rarely occur.
- Worked example (book table): 1NF moves multi-valued Subject to a Title–Subject table; 2NF moves Price (dependent on Title+Format) to its own table; 3NF moves Author Nationality, Publisher Country and Genre Name into Author/Publisher/Genre tables; 4NF splits Franchisee–Book–Location into Franchisee–Book and Franchisee–Location; ETNF splits Supplier–Book–Franchisee into three pairwise tables; 5NF needs a surrogate Store ID to reconstruct the join; DKNF replaces the Thickness convention with an enumeration table of page ranges; 6NF splits Publisher into (ID, Name) and (ID, Country).
- Caveats: 6NF's table proliferation and multi-table updates make it unsuitable for OLTP, though columnar warehouses use it internally.

## Denormalization — Wikipedia — https://en.wikipedia.org/wiki/Denormalization
- Cited by README at line 1009 in section "Persistence models" to support: denormalization as the other database change that should not ripple into domain entities.
- Fetch status: fetched.
- Definition: a strategy applied to a previously normalized database to increase (read) performance at the cost of some write performance, by adding redundant copies of data or grouping data; motivated by very high read volumes; benefits are only fully realized on a model that is otherwise normalized, since a normalized design stores related data in separate relations whose joins can be prohibitively slow.
- Two approaches: DBMS-level — the logical design stays normalized and the DBMS stores redundant data (indexed views in SQL Server, materialized views in Oracle/PostgreSQL) and keeps it consistent; DBA-level — the logical design itself is denormalized, and the designer must keep it consistent with constraints that synchronize the redundant copies, whose complexity may make the exercise pointless and hazardous.
- Consistency: the article discusses only constraints (not triggers, application logic or batch jobs).
- Trade-offs: faster SELECT, slower INSERT/UPDATE/DELETE; under heavy write load a denormalized database can perform worse than its normalized equivalent; more logical complexity; more storage (minor in the 2020s except for enormous systems).
- Denormalized vs unnormalized: not the same — denormalize only after reaching a satisfactory normalization level (e.g. all relations in 3NF with join/multivalued dependencies handled) and with the rules for the inherent anomalies in place.
- Techniques: storing the count of the "many" side on the "one" relation; copying attributes from a relation that will be joined; star schemas extended to snowflake schemas; prebuilt summaries/OLAP cubes.
- Trend: with cheaper storage, processing and bandwidth, denormalization has become commonplace (citation flagged).

## TypeORM — typeorm.io — https://typeorm.io/
- Cited by README at line 1018 in section "Persistence models" to support: using an ORM such as TypeORM for simplicity in smaller projects (the README itself uses raw queries with Slonik because ORMs are not flexible and performant enough for complex projects).
- Fetch status: fetched (current landing page, which now reflects TypeORM 1.0).
- What it is: a TypeScript-first database library/ORM supporting both Data Mapper and Active Record patterns; runs on Node.js, browsers, Cordova, Ionic, React Native, NativeScript, Expo and Electron; databases: CockroachDB, Google Spanner, MariaDB, MongoDB, MS SQL Server, MySQL, Oracle, PostgreSQL, SAP HANA, SQLite.
- Features listed: flexible patterns (DataMapper/ActiveRecord); TypeScript-first type safety for models; multi-database support; a QueryBuilder with joins, pagination and caching; migrations and schema with automatic migration generation; cross-platform.
- Example (TypeScript): `@Entity() class User { @PrimaryGeneratedColumn() id: number; @Column() firstName: string; @Column() lastName: string; @Column() age: number; }` shown in Data Mapper and Active Record tabs; no DataSource/repository code on the landing page (Get Started guide linked).
- Notes: TypeORM 1.0 is released with an upgrade guide from 0.3; 0.3.x docs remain as "Legacy" at v0.typeorm.io; the page does not mention Hibernate/Doctrine/Entity Framework inspiration.

## Stack Overflow question: DDD - Persistence Model and Domain Model — Stack Overflow (2012) — https://stackoverflow.com/questions/14024912/ddd-persistence-model-and-domain-model
- Cited by README at line 1022 in section "Persistence models" to support: the debate on separating the domain model from the persistence model.
- Fetch status: NOT FETCHED — stackoverflow.com and api.stackexchange.com are both blocked for the fetch tool (two attempts).
- What it contains (from model knowledge, not fetched; details unverified): the asker has a domain model and an ORM-mapped persistence model and asks whether both are really needed given the duplication and mapping effort; the high-voted answers argue that they are different models with different purposes — the domain model should not be constrained by ORM requirements (public setters, parameterless constructors, virtual members, navigation properties), and the repository is where the mapping between them happens, typically by extracting the entity's state (memento/state object, or serializing it) into the persistence entity and rebuilding the domain object on load; a pragmatic counter-view says that when the ORM can map private fields and the models coincide, keeping one class is acceptable for simpler domains, and that event sourcing sidesteps the question by persisting events rather than state. Treat this paragraph as orientation only.
- Rules the README draws from it: domain entities keep the shape that suits domain logic; persistence models keep the shape that suits the database; a mapper translates in both directions.

## Just Stop It! The Domain Model Is Not The Persistence Model — Mike Mogosanu (Sapiens Works, 2012) — https://blog.sapiensworks.com/post/2012/04/07/Just-Stop-It!-The-Domain-Model-Is-Not-The-Persistence-Model.aspx
- Cited by README at line 1023 in section "Persistence models" to support: domain and persistence models are separate models in separate layers.
- Fetch status: fetched.
- What it argues: the domain model (real-life problems and solutions, focused on behaviour) and the persistence model (what data is stored and how, focused on storage structure) are different models with different purposes and responsibilities; treating an EF/NHibernate entity as a domain object is wrong in roughly 99% of cases (author's estimate) and is a common error in Stack Overflow DDD questions.
- Rules and reasoning:
  - The domain depends on nothing; it must not know persistence details (EF, NHibernate); at domain-design time the database effectively does not exist.
  - The persistence layer serves and depends on the domain, never the reverse.
  - Persistence entities are designed separately, shaped for storage and ORM constraints (the one example given: all properties `virtual` for the ORM).
  - A system therefore has two sets of entities, domain entities and persistence entities; when they look identical (very simple domains) that is coincidence, not identity.
  - Modeling in a repository or an ORM is modeling persistence, not the domain.
  - Start with the domain, ignoring database concerns (attributed to Eric Evans): infrastructure details taint the domain, database-centric starts make everything evolve around and be constrained by the database, and the application exists for the domain while the database is an implementation detail.
- Vocabulary: domain model, persistence model, domain entities, persistence entities, persistence layer, persistence implementation detail.
- Examples: none in code beyond the `virtual` remark.
- Anti-patterns/caveats: database-centric design; ORM entities as domain objects; infrastructure in the domain; the article does not discuss mapping mechanics (memento/state objects, serialization), read models, or the cost of keeping two models.
- How it applies to TypeScript/NestJS: matches the README's `UserEntity` (domain) vs `userSchema`/`UserModel` (persistence) with `user.mapper.ts` between them.

## Comparing SQL, query builders, and ORMs — Prisma Data Guide — https://www.prisma.io/dataguide/types/relational/comparing-sql-query-builders-and-orms
- Cited by README at line 1024 in section "Persistence models" to support: choosing raw queries (Slonik) over an ORM for complex projects.
- Fetch status: fetched.
- What it argues: raw SQL, query builders and ORMs sit at different abstraction levels and trade control and transparency for convenience; no option is best for every project — choose by application requirements, the team's database knowledge and the cost of the abstraction (or its absence).
- Comparison table: raw SQL — database-oriented, high hands-on management, no abstraction, low complexity; query builders — mixed focus, low management, low abstraction, low complexity; ORMs — programming-oriented, low management, high abstraction, high complexity.
- Raw SQL: send native queries through a driver and receive native result formats. Benefits — few surprises and moving parts; performance (generated SQL can be inefficient; hand-written SQL uses domain knowledge); flexibility (full expressiveness and all engine features). Drawbacks — you must know the data structure; you translate between application types and database constructs yourself; input safety is entirely on you (SQL injection); queries are strings needing escaping/concatenation.
- Query builders: a layer above the native language that formalizes query patterns as chainable methods per clause with sanitization and escaping. Benefits — queries use the application's own constructs, easier to manage than strings, operators vs data are distinguishable, decomposable; the underlying language is not hidden, so SQL-literate developers can predict behaviour; often multi-backend, easing migration. Drawbacks — still requires SQL knowledge plus the builder's syntax; no automatic mapping to application objects; some operations are impossible through the methods, and the raw-query escape hatch sidesteps rather than solves this. Summary: a thin templating-like layer over SQL.
- ORMs: translate between relational representations and in-memory objects. Benefits — data is reasoned about inside the application as if storage were an extension of it, so developers focus on business logic; less boilerplate; automated object-to-table mapping; migration tools that track schema changes with code. Drawbacks — hiding the backend is never complete, and ignorance of the underlying SQL/schema leads to bad assumptions and hard debugging/tuning; the object-relational impedance mismatch grows with complexity; generally slower, especially for complex queries, generating complicated SQL for simple operations; trusting the ORM to do the right thing causes costly late-caught mistakes; the mismatch has been called "the Vietnam of computer science". Summary: good for design and iteration, but the same features hinder understanding, debugging, paradigm changes and performance.
- Active Record vs Data Mapper: Active Record — objects wrap rows and carry save/update/delete; easy to conceptualize; but tightly coupled to the database (harder migration and testing), relies on the database to fill gaps, and magic translation can hurt performance with complex objects. Data Mapper — an independent layer mediates between code and database so each exists independently and the developer maps explicitly; avoids coupling and hidden operations, separates business logic from mapping/serialization; costs significantly more mapping work.
- Vocabulary: abstraction layer; database driver; injection attack; native query; object-relational impedance mismatch; persistence framework; query builder; data mapper; SQL; (FAQ) visual/online SQL query builders.
- Examples: none — no code in the article.

## Secure by Design: Chapter 6.2.2 ORM frameworks and no-arg constructors — Johnsson, Deogun, Sawano (Manning liveBook) — https://livebook.manning.com/book/secure-by-design/chapter-6/40
- Cited by README at line 1025 in section "Persistence models" to support: ORM requirements (no-arg constructors) conflict with always-valid domain entities, another reason to separate persistence models.
- Fetch status: PARTIAL — only the chapter-6 opening and section headings are visible; section 6.2.2's body is paywalled.
- Visible content: chapter 6 "Ensuring integrity of state" covers managing mutable state with entities, ensuring an entity is consistent on creation, and keeping its integrity; the intro uses an online bookstore (cart, payment, shipping as state changes) and favours modelling mutable state explicitly as DDD entities; footnote: Haskell aims for immutability while Java, C, C#, Ruby and Python use mutable constructs. Headings: 6.1 managing state using entities; 6.2 consistent on creation — the perils of no-arg constructors, ORM frameworks and no-arg constructors, all mandatory fields as constructor arguments, construction with a fluent interface, catching advanced constraints in code, the builder pattern for upholding advanced constraints, ORM frameworks and advanced constraints, which construction to use when; 6.3 integrity of entities — getter and setter methods, avoid sharing mutable objects, securing the integrity of collections.
- From model knowledge, not fetched (the section's substance as published): a public no-arg constructor lets an entity exist half-initialized, so invariants cannot be guaranteed at creation; JPA/Hibernate-style ORMs require a no-arg constructor to instantiate entities on load, which conflicts with "all mandatory fields as constructor arguments"; the recommended compromise is to keep the no-arg constructor non-public (private/protected) so only the framework uses it while application code must use the full constructor that validates every mandatory field (`notNull`, domain primitives), to express advanced constraints with a fluent interface or builder, and, where the ORM bypasses constructor validation, to re-validate after load or keep the persistence representation separate from the domain entity; 6.3 adds: avoid public setters, never expose or share mutable internal objects, and return defensive copies/immutable views of collections.
- How it applies to TypeScript/NestJS: TypeORM entities with decorators and an implicit constructor are the TypeScript analogue; the README avoids the conflict by mapping a plain persistence model (`UserModel`) to a domain entity created through a validating factory.
