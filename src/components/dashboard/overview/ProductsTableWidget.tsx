import { useEffect, useState } from 'react';
import type { InventoryBand, InventoryRow } from '../../../utils/inventoryMetrics';
import { TablePagination } from '../TablePagination';

const BAND_TEXT: Record<InventoryBand, string> = {
  stockout: 'text-band-red',
  reorder: 'text-band-amber',
  healthy: 'text-band-green',
  overstock: 'text-band-blue',
};

interface ProductsTableWidgetProps {
  rows: InventoryRow[];
  pageSize: number;
  onOpen?: (sku: string) => void;
}

/** Paginated SKU table for the Products widget - a full unpaginated list doesn't fit a fixed-height card once there are more than a handful of SKUs. */
export function ProductsTableWidget({ rows, pageSize, onOpen }: ProductsTableWidgetProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage(0);
  }, [rows.length, pageSize]);

  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  if (rows.length === 0) {
    return <p className="text-[11.5px] text-white/40">No products yet.</p>;
  }

  return (
    <div>
      <table className="w-full text-xs table-fixed">
        <thead>
          <tr className="text-left text-white/40 font-mono-ibm text-[10px]">
            <th className="pb-1.5 font-medium">Product</th>
            <th className="pb-1.5 font-medium w-[72px] text-right">Stock</th>
            <th className="pb-1.5 font-medium w-[72px] text-right">Sold</th>
            <th className="pb-1.5 font-medium w-[72px] text-right">Cover</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map(r => (
            <tr
              key={r.id}
              onClick={() => onOpen?.(r.id)}
              className={`border-t border-white/[0.05] ${onOpen ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
            >
              <td className="py-1.5 pr-3">
                <div className="truncate text-white/85">{r.name}</div>
                <div className="font-mono-ibm text-[10px] text-white/35">{r.sku}</div>
              </td>
              <td className="py-1.5 text-right font-mono-ibm text-white/85">{r.stock}</td>
              <td className="py-1.5 text-right font-mono-ibm text-white/85">{r.unitsSoldWindow}</td>
              <td className={`py-1.5 text-right font-mono-ibm font-semibold ${BAND_TEXT[r.band]}`}>{r.coverLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TablePagination
        page={page}
        pageCount={pageCount}
        totalLabel={`${rows.length} SKUs`}
        onPageChange={setPage}
        className="mt-2.5 pt-2 border-t border-white/[0.06]"
      />
    </div>
  );
}
