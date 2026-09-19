export default function NumberPad({
  digits,
  maxLength,
  onChange,
  submitLabel,
  onSubmit,
  submitDisabled,
  clearLabel = "Clear",
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "join"];

  function press(value) {
    if (value === "clear") {
      onChange("");
      return;
    }
    if (value === "join") {
      if (!submitDisabled) onSubmit();
      return;
    }
    onChange(digits.length < maxLength ? `${digits}${value}` : digits);
  }

  return (
    <div className="mt-8 grid grid-cols-3 gap-3">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          disabled={key === "join" && submitDisabled}
          aria-label={
            key === "clear" ? clearLabel : key === "join" ? submitLabel : `Digit ${key}`
          }
          className={`min-h-20 rounded-2xl text-[28px] font-bold disabled:opacity-40 ${
            key === "join"
              ? "bg-teal text-cream"
              : "border-4 border-teal bg-white text-teal"
          }`}
        >
          {key === "clear" ? clearLabel : key === "join" ? submitLabel : key}
        </button>
      ))}
    </div>
  );
}
