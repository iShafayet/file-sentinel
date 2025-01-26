const joinUrlParts = (...parts: string[]) => {
  const del = "/";
  return (
    del +
    parts
      .map((part) => String(part))
      .map((part) => {
        while (part.indexOf(del) == 0) {
          part = part.slice(1, part.length);
        }

        while (part.length > 0 && part.lastIndexOf(del) == part.length - 1) {
          part = part.slice(0, part.length - 2);
        }

        return part;
      })
      .filter((part) => part.length > 0)
      .join(del)
  );
};

export { joinUrlParts };
