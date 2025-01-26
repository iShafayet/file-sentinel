const teardown = async () => {
  console.log("TESTSUITE TEARDOWN");
  if (global.fileSentinel) {
    await global.fileSentinel.terminate();
  }
  console.log("TESTSUITE TEARDOWN DONE");
};

export default teardown;
