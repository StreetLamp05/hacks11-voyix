"use client";

type Props = {
  rows: Record<string, unknown>[];
};

export default function ResultsTable({ rows }: Props) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">No results.</p>;

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto rounded border border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-800 text-left text-gray-300">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i % 2 === 0 ? "bg-gray-900" : "bg-gray-950"}
            >
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 whitespace-nowrap">
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
