export function SortSelect({ options, value, onChange, style }) {
  return (
    <select className="material-button" value={value} onChange={(event) => onChange(Number(event.target.value))} style={style}>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
