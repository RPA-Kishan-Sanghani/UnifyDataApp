import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { FieldDefinition } from "@/data/helpContent";

interface FieldReferenceTableProps {
  fields: FieldDefinition[];
}

export function FieldReferenceTable({ fields }: FieldReferenceTableProps) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 dark:bg-slate-800">
            <TableHead className="font-semibold">Field Name</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Required</TableHead>
            <TableHead className="font-semibold">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, index) => (
            <TableRow key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <TableCell className="font-medium">
                {field.name}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {field.type}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={field.required ? "destructive" : "secondary"} className="text-xs">
                  {field.required ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell className="max-w-md">
                <div className="space-y-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{field.description}</p>
                  {field.validation && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium">Validation:</span> {field.validation}
                    </p>
                  )}
                  {field.example && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      <span className="font-medium">Example:</span> {field.example}
                    </p>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
