/**
 * Runs before the test file is loaded. `CoreModule.forRoot()` validates the environment at
 * *import* time of AppModule (inside the @Module decorator), so anything the tests need in
 * process.env must be set here, not in beforeAll.
 */
process.env.NODE_ENV = 'test';
