"use client"

import { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  RefreshCw, 
  Table as TableIcon, 
  TrendingUp, 
  FileSpreadsheet,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "motion/react";

import { fetchSheetData, exportToCSV, ProductionData } from './services/dataService';
import { ProductionChart } from './components/ProductionChart';
import { DateRangePicker } from './components/DateRangePicker';

export default function App() {
  const [allData, setAllData] = useState<ProductionData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedParam, setSelectedParam] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, columns: cols } = await fetchSheetData();
      setAllData(data);
      setColumns(cols);
      
      // Auto-select first numeric parameter
      if (cols.length > 0) {
        setSelectedParam(cols[0]);
      }

      // Initialize date range if data exists
      if (data.length > 0) {
        const earliest = data[0].date;
        const latest = data[data.length - 1].date;
        setDateRange({ from: earliest, to: latest });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return allData;
    
    return allData.filter(item => {
      const date = item.date;
      return isWithinInterval(date, { 
        start: startOfDay(dateRange.from!), 
        end: endOfDay(dateRange.to!) 
      });
    });
  }, [allData, dateRange]);

  const stats = useMemo(() => {
    if (!filteredData.length || !selectedParam) return { avg: 0, total: 0, min: 0, max: 0 };
    
    const values = filteredData.map(d => Number(d[selectedParam])).filter(v => !isNaN(v));
    if (!values.length) return { avg: 0, total: 0, min: 0, max: 0 };

    const total = values.reduce((a, b) => a + b, 0);
    return {
      total,
      avg: total / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [filteredData, selectedParam]);

  const handleExport = () => {
    if (filteredData.length) {
      exportToCSV(filteredData, `Production_Report_${format(new Date(), 'yyyyMMdd')}.csv`);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">Error Loading Dashboard</h1>
        <p className="text-muted-foreground mb-6 text-center max-w-md">{error}</p>
        <Button onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-primary/10">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between mx-auto px-4 md:px-8">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Production Flow</h1>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest hidden sm:block">Operational Intelligence</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="hidden sm:flex">
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button size="sm" onClick={handleExport} disabled={isLoading || !filteredData.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">
        {/* Controls */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 rounded-xl border shadow-sm"
        >
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Range</label>
              <DateRangePicker range={dateRange} onRangeChange={setDateRange} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Metric</label>
              <Select value={selectedParam} onValueChange={setSelectedParam}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue placeholder="Select parameter" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-2">
             <Badge variant="secondary" className="px-3 py-1 font-mono text-[10px]">
                {filteredData.length} RECORDS FOUND
             </Badge>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <RefreshCw className="h-10 w-10 animate-spin text-primary/40" />
             <p className="text-muted-foreground animate-pulse font-medium">Syncing data from Cloud...</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Average Production" value={stats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })} icon={TrendingUp} />
              <StatCard title="Total Quantity" value={stats.total.toLocaleString()} icon={FileSpreadsheet} />
              <StatCard title="Peak Performance" value={stats.max.toLocaleString()} icon={TrendingUp} color="emerald" />
              <StatCard title="Minimum Level" value={stats.min.toLocaleString()} icon={AlertCircle} color="amber"/>
            </div>

            {/* Dashboard Tabs */}
            <Tabs defaultValue="analytics" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-white border">
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="table">Raw Data</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="analytics" className="space-y-4">
                <Card className="border shadow-md overflow-hidden bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          {selectedParam} Trends
                        </CardTitle>
                        <CardDescription>Historical performance over selected interval</CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-slate-50 capitalize">{selectedParam}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ProductionChart data={filteredData} parameter={selectedParam} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="table">
                <Card className="border shadow-md bg-white">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold">Production Logs</CardTitle>
                      <CardDescription>Complete transaction history</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleExport} className="text-primary">
                      <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow>
                            <TableHead className="w-[150px] font-bold uppercase text-[10px] tracking-wider">Date</TableHead>
                            {columns.map(col => (
                              <TableHead key={col} className="font-bold uppercase text-[10px] tracking-wider text-right">{col}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredData.slice().reverse().map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="font-mono text-xs font-semibold">
                                {format(row.date, 'MMM dd, yyyy')}
                              </TableCell>
                              {columns.map(col => (
                                <TableCell key={col} className="text-right font-mono text-xs tabular-nums">
                                  {row[col]?.toLocaleString() || '-'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                          {filteredData.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground italic">
                                No data found for the selected range.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <footer className="border-t py-6 bg-white mt-12">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-500">Production Dashboard &copy; 2026</p>
          <div className="flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">Live System Connectivity Active</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color = "blue" }: { 
  title: string; 
  value: string | number; 
  icon: any;
  color?: "blue" | "emerald" | "amber" | "indigo"
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  };

  return (
    <Card className="border shadow-sm bg-white hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{title}</p>
            <div className="text-2xl font-bold tracking-tighter tabular-nums">{value}</div>
          </div>
          <div className={cn("p-2.5 rounded-xl border flex items-center justify-center", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
