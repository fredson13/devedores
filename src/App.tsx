import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Users, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  ChevronRight,
  UserPlus,
  DollarSign,
  Calendar,
  X,
  Send,
  LayoutDashboard,
  FileText,
  CheckCircle2,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, parseISO, isValid, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Customer, Transaction } from './types';

export default function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'reports'>('dashboard');
  const [allTransactions, setAllTransactions] = useState<(Transaction & { customer_name?: string, closure_id?: number | null })[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [showClosureConfirm, setShowClosureConfirm] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<any | null>(null);
  const [closureTransactions, setClosureTransactions] = useState<any[]>([]);
  const [loadingClosureDetails, setLoadingClosureDetails] = useState(false);

  const formatDate = (dateStr: string, formatStr: string) => {
    if (!dateStr) return '---';
    try {
      // SQLite format is YYYY-MM-DD HH:MM:SS, we need to make it ISO friendly
      const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
      const date = new Date(isoStr);
      if (!isValid(date)) return 'Data inválida';
      return format(date, formatStr, { locale: ptBR });
    } catch (e) {
      return 'Erro na data';
    }
  };

  // Form states
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [newTransaction, setNewTransaction] = useState({ amount: '', description: '', type: 'debt' });

  useEffect(() => {
    fetchCustomers();
    fetchAllTransactions();
    fetchClosures();
  }, []);

  const fetchClosures = async () => {
    try {
      const res = await fetch('/api/closures');
      const data = await res.json();
      setClosures(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchClosureTransactions = async (closureId: number) => {
    setLoadingClosureDetails(true);
    try {
      const res = await fetch(`/api/closures/${closureId}/transactions`);
      const data = await res.json();
      setClosureTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClosureDetails(false);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      setAllTransactions(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedCustomerId) {
      fetchTransactions(selectedCustomerId);
      // Scroll to top on mobile when selecting a customer
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedCustomerId]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (id: number) => {
    try {
      const res = await fetch(`/api/customers/${id}/transactions`);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      const data = await res.json();
      setCustomers([...customers, data]);
      setIsAddingCustomer(false);
      setNewCustomer({ name: '', phone: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amount = parseFloat(newTransaction.amount) * (newTransaction.type === 'payment' ? -1 : 1);
    
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          amount,
          description: newTransaction.description,
        }),
      });
      
      // Refresh data
      fetchTransactions(selectedCustomer.id);
      fetchCustomers();
      fetchAllTransactions();
      setIsAddingTransaction(false);
      setNewTransaction({ amount: '', description: '', type: 'debt' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este cliente e todo o histórico?')) return;
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      setCustomers(customers.filter(c => c.id !== id));
      if (selectedCustomerId === id) setSelectedCustomerId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClosure = async () => {
    console.log("handleClosure triggered");
    
    // Check if we have transactions to close
    if (!weeklyTransactions || weeklyTransactions.length === 0) {
      console.log("No transactions to close");
      alert('Não há transações pendentes para fechar.');
      return;
    }

    setShowClosureConfirm(false);
    setIsClosing(true);
    try {
      const payload = {
        total_received: totalWeeklyReceived,
        total_debts: totalWeeklyDebts,
        start_date: format(weekStart, 'yyyy-MM-dd HH:mm:ss'),
        end_date: format(weekEnd, 'yyyy-MM-dd HH:mm:ss'),
        transaction_ids: weeklyTransactions.map(t => t.id),
      };
      
      console.log("Sending closure request with payload:", payload);

      const res = await fetch('/api/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      console.log("Response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Closure error response text:", errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || 'Erro ao realizar fechamento');
      }
      
      const result = await res.json();
      console.log("Closure success result:", result);

      // Refresh all data
      await Promise.all([
        fetchClosures(),
        fetchAllTransactions(),
        fetchCustomers()
      ]);
      
      alert('Fechamento realizado com sucesso!');
    } catch (err: any) {
      console.error("Closure execution error:", err);
      alert('Erro ao fechar caixa: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsClosing(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalReceivable = customers.reduce((acc, curr) => acc + curr.total_debt, 0);
  const topDebtors = [...customers].sort((a, b) => b.total_debt - a.total_debt).slice(0, 5);

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

  const weeklyTransactions = allTransactions.filter(t => {
    if (!t || !t.date) return false;
    try {
      const tDate = new Date(t.date.replace(' ', 'T'));
      if (!isValid(tDate)) return false;
      return isWithinInterval(tDate, { start: weekStart, end: weekEnd }) && !t.closure_id;
    } catch (e) {
      return false;
    }
  });

  const weeklyPayments = weeklyTransactions.filter(t => t.amount < 0);
  const weeklyDebts = weeklyTransactions.filter(t => t.amount > 0);
  const totalWeeklyReceived = Math.abs(weeklyPayments.reduce((acc, t) => acc + t.amount, 0));
  const totalWeeklyDebts = weeklyDebts.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Navigation Rail */}
      <div className="w-full md:w-20 bg-zinc-900 flex md:flex-col items-center justify-between p-4 md:py-8 z-30">
        <div className="flex md:flex-col items-center gap-8">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <DollarSign size={24} />
          </div>
          <nav className="flex md:flex-col gap-6">
            <button 
              onClick={() => { setActiveTab('dashboard'); setSelectedCustomerId(null); }}
              className={`p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Dashboard"
            >
              <LayoutDashboard size={24} />
            </button>
            <button 
              onClick={() => setActiveTab('customers')}
              className={`p-3 rounded-xl transition-all ${activeTab === 'customers' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Clientes"
            >
              <Users size={24} />
            </button>
            <button 
              onClick={() => { setActiveTab('reports'); setSelectedCustomerId(null); }}
              className={`p-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Relatórios"
            >
              <FileText size={24} />
            </button>
          </nav>
        </div>
        <div className="hidden md:block">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-bold">
            LF
          </div>
        </div>
      </div>

      {/* Sidebar / Customer List (Only visible in Customers tab or if a customer is selected) */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-zinc-200 flex flex-col md:h-screen sticky top-0 z-20 ${activeTab === 'customers' || (activeTab === 'dashboard' && selectedCustomerId) ? (selectedCustomerId ? 'hidden md:flex' : 'flex') : 'hidden'}`}>
        <div className="p-6 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                <DollarSign size={20} />
              </div>
              Devedores
            </h1>
            <button 
              onClick={() => setIsAddingCustomer(true)}
              className="p-2 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              className="w-full pl-10 pr-4 py-2 bg-zinc-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-2"></div>
              <p className="text-sm">Carregando...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-10 text-zinc-400">
              <Users className="mx-auto mb-2 opacity-20" size={48} />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            filteredCustomers.map(customer => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
                className={`w-full text-left p-4 rounded-2xl transition-all group ${
                  selectedCustomerId === customer.id 
                    ? 'bg-emerald-50 border-emerald-100 shadow-sm' 
                    : 'hover:bg-zinc-50 border-transparent'
                } border`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`font-semibold ${selectedCustomer?.id === customer.id ? 'text-emerald-900' : 'text-zinc-900'}`}>
                      {customer.name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">{customer.phone || 'Sem telefone'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-medium ${customer.total_debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      R$ {customer.total_debt.toFixed(2)}
                    </p>
                    <ChevronRight size={16} className={`ml-auto mt-1 transition-transform ${selectedCustomer?.id === customer.id ? 'translate-x-1 text-emerald-400' : 'text-zinc-300'}`} />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen md:h-screen overflow-y-auto ${activeTab !== 'customers' && !selectedCustomerId ? 'flex' : (selectedCustomerId ? 'flex' : 'hidden md:flex')}`}>
        {selectedCustomer ? (
          <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-8">
            {/* Mobile Back Button */}
            <button 
              onClick={() => setSelectedCustomerId(null)}
              className="md:hidden flex items-center gap-2 text-zinc-500 mb-4"
            >
              <X size={20} />
              Voltar para a lista
            </button>
            {/* Customer Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
                    {selectedCustomer.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-zinc-900">{selectedCustomer.name}</h2>
                    <p className="text-zinc-500 flex items-center gap-1">
                      <Calendar size={14} />
                      Cliente desde {formatDate(selectedCustomer.created_at, "MMMM 'de' yyyy")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsAddingTransaction(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  <Plus size={18} />
                  Novo Lançamento
                </button>
                <button 
                  onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                <p className="text-sm font-medium text-zinc-500 mb-1">Saldo Atual</p>
                <h3 className={`text-3xl font-bold font-mono ${selectedCustomer.total_debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  R$ {selectedCustomer.total_debt.toFixed(2)}
                </h3>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                <p className="text-sm font-medium text-zinc-500 mb-1">Total de Compras</p>
                <h3 className="text-3xl font-bold font-mono text-zinc-900">
                  R$ {transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0).toFixed(2)}
                </h3>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                <p className="text-sm font-medium text-zinc-500 mb-1">Total Pago</p>
                <h3 className="text-3xl font-bold font-mono text-emerald-600">
                  R$ {Math.abs(transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0)).toFixed(2)}
                </h3>
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="font-bold text-zinc-900">Histórico de Lançamentos</h3>
              </div>
              <div className="divide-y divide-zinc-50">
                {transactions.length === 0 ? (
                  <div className="p-10 text-center text-zinc-400">
                    Nenhum lançamento registrado.
                  </div>
                ) : (
                  transactions.map(t => (
                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.amount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {t.amount > 0 ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900">{t.description || (t.amount > 0 ? 'Compra' : 'Pagamento')}</p>
                          <p className="text-xs text-zinc-500">{formatDate(t.date, "dd 'de' MMM, HH:mm")}</p>
                        </div>
                      </div>
                      <p className={`font-mono font-bold text-lg ${t.amount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {t.amount > 0 ? '+' : '-'} R$ {Math.abs(t.amount).toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <div className="flex-1 flex flex-col p-6 lg:p-10 max-w-6xl mx-auto w-full space-y-10">
            {/* Dashboard Overview */}
            <div className="space-y-2">
              <h2 className="text-4xl font-bold tracking-tight text-zinc-900">Olá, Lucas!</h2>
              <p className="text-zinc-500">Aqui está o resumo do seu negócio hoje.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-zinc-900 text-white p-8 rounded-[2rem] relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-zinc-400 font-medium mb-2">Total a Receber</p>
                  <h3 className="text-4xl font-bold font-mono mb-4">R$ {totalReceivable.toFixed(2)}</h3>
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                    <TrendingUp size={16} />
                    <span>+12% este mês</span>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
                <p className="text-zinc-500 font-medium mb-2">Clientes Ativos</p>
                <h3 className="text-4xl font-bold text-zinc-900 mb-4">{customers.length}</h3>
                <div className="flex -space-x-2">
                  {customers.slice(0, 5).map(c => (
                    <div key={c.id} className="w-8 h-8 rounded-full bg-zinc-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-zinc-600">
                      {c.name.charAt(0)}
                    </div>
                  ))}
                  {customers.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                      +{customers.length - 5}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
                <p className="text-zinc-500 font-medium mb-2">Pagamentos Hoje</p>
                <h3 className="text-4xl font-bold text-emerald-600 mb-4">R$ 0,00</h3>
                <p className="text-sm text-zinc-400 italic">Nenhum recebimento ainda</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chart */}
              <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm space-y-6">
                <h3 className="font-bold text-zinc-900">Maiores Devedores</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topDebtors}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar 
                        dataKey="total_debt" 
                        radius={[8, 8, 0, 0]}
                        onClick={(data: any) => {
                          if (data && data.id) {
                            setSelectedCustomerId(Number(data.id));
                            setActiveTab('customers');
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {topDebtors.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#18181b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Actions / Recent */}
              <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm space-y-6">
                <h3 className="font-bold text-zinc-900">Ações Rápidas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIsAddingCustomer(true)}
                    className="flex flex-col items-center justify-center p-6 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-all group"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-zinc-900 shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      <UserPlus size={24} />
                    </div>
                    <span className="text-sm font-semibold text-zinc-900">Novo Cliente</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-6 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-all group">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-zinc-900 shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      <TrendingUp size={24} />
                    </div>
                    <span className="text-sm font-semibold text-zinc-900">Relatórios</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'reports' ? (
          <div className="flex-1 flex flex-col p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-10">
            <div className="space-y-2">
              <h2 className="text-4xl font-bold tracking-tight text-zinc-900">Fechamento de Caixa</h2>
              <p className="text-zinc-500">Resumo semanal de entradas e saídas.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-emerald-600 text-white p-8 rounded-[2.5rem] shadow-xl shadow-emerald-600/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <ArrowDownLeft size={24} />
                  </div>
                  <span className="font-semibold">Total Recebido (Semana)</span>
                </div>
                <h3 className="text-4xl font-bold font-mono">R$ {totalWeeklyReceived.toFixed(2)}</h3>
                <p className="mt-4 text-emerald-100 text-sm">
                  {format(weekStart, "dd/MM")} até {format(weekEnd, "dd/MM")}
                </p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-zinc-500">
                  <div className="p-2 bg-zinc-100 rounded-lg">
                    <ArrowUpRight size={24} />
                  </div>
                  <span className="font-semibold">Novas Dívidas (Semana)</span>
                </div>
                <h3 className="text-4xl font-bold font-mono text-zinc-900">R$ {totalWeeklyDebts.toFixed(2)}</h3>
                <div className="mt-4 flex items-center gap-2 text-zinc-400 text-sm">
                  <TrendingUp size={16} />
                  <span>{weeklyDebts.length} novos registros</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">Pagamentos Recebidos</h3>
                <div className="flex items-center gap-2 text-sm text-zinc-500 bg-zinc-50 px-4 py-2 rounded-full">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Caixa Aberto
                </div>
              </div>
              <div className="divide-y divide-zinc-50">
                {weeklyPayments.length === 0 ? (
                  <div className="p-20 text-center text-zinc-400">
                    Nenhum pagamento registrado nesta semana.
                  </div>
                ) : (
                  weeklyPayments.map(t => (
                    <div key={t.id} className="p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <DollarSign size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{t.customer_name}</p>
                          <p className="text-sm text-zinc-500">{t.description || 'Pagamento de conta'}</p>
                          <p className="text-xs text-zinc-400 mt-1">{formatDate(t.date, "eeee, dd 'de' MMMM")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-xl text-emerald-600">
                          R$ {Math.abs(t.amount).toFixed(2)}
                        </p>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded">Recebido</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {weeklyPayments.length > 0 && (
                <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex justify-center">
                  <button 
                    onClick={() => setShowClosureConfirm(true)}
                    disabled={isClosing}
                    className="flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20 disabled:opacity-50"
                  >
                    <CheckCircle2 size={20} />
                    {isClosing ? 'Processando...' : 'Realizar Fechamento Semanal'}
                  </button>
                </div>
              )}
            </div>

            {/* Closure History */}
            {closures.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-zinc-900">Histórico de Fechamentos</h3>
                <div className="space-y-4">
                  {closures.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => {
                        setSelectedClosure(c);
                        fetchClosureTransactions(c.id);
                      }}
                      className="w-full bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-emerald-500/50 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-600 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                          <FileText size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">#{c.id}</span>
                            <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
                            <p className="text-sm font-bold text-zinc-900">Fechado em {formatDate(c.created_at, "dd/MM/yyyy")}</p>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            Período: {formatDate(c.start_date, "dd/MM/yyyy")} até {formatDate(c.end_date, "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Recebido</p>
                          <p className="text-lg font-bold text-emerald-600 font-mono">R$ {c.total_received.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Dívidas</p>
                          <p className="text-lg font-bold text-zinc-900 font-mono">R$ {c.total_debts.toFixed(2)}</p>
                        </div>
                        <ChevronRight size={20} className="text-zinc-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-10 text-center">
            <div className="max-w-md space-y-4">
              <Users size={64} className="mx-auto text-zinc-200" />
              <h3 className="text-2xl font-bold text-zinc-900">Selecione um cliente</h3>
              <p className="text-zinc-500">Escolha um cliente na lista ao lado para ver o histórico completo e realizar novos lançamentos.</p>
              <button 
                onClick={() => setActiveTab('customers')}
                className="md:hidden px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold"
              >
                Ver Lista de Clientes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingCustomer(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-zinc-900">Novo Cliente</h3>
                  <button onClick={() => setIsAddingCustomer(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddCustomer} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700">Nome Completo</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-zinc-100 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="Ex: João Silva"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700">WhatsApp / Telefone</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-zinc-100 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="(00) 00000-0000"
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20"
                  >
                    Cadastrar Cliente
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingTransaction(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-zinc-900">Novo Lançamento</h3>
                  <button onClick={() => setIsAddingTransaction(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddTransaction} className="space-y-6">
                  <div className="flex p-1 bg-zinc-100 rounded-2xl">
                    <button 
                      type="button"
                      onClick={() => setNewTransaction({...newTransaction, type: 'debt'})}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${newTransaction.type === 'debt' ? 'bg-white text-red-600 shadow-sm' : 'text-zinc-500'}`}
                    >
                      Dívida (Fiado)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewTransaction({...newTransaction, type: 'payment'})}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${newTransaction.type === 'payment' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500'}`}
                    >
                      Pagamento
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700">Valor (R$)</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      className="w-full px-4 py-3 bg-zinc-100 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-2xl font-mono font-bold"
                      placeholder="0,00"
                      value={newTransaction.amount}
                      onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700">Descrição / Produto</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-zinc-100 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="Ex: Cerveja, Arroz, Parcela 1..."
                      value={newTransaction.description}
                      onChange={e => setNewTransaction({...newTransaction, description: e.target.value})}
                    />
                  </div>
                  <button 
                    type="submit"
                    className={`w-full py-4 text-white rounded-2xl font-bold transition-all shadow-lg ${newTransaction.type === 'debt' ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'}`}
                  >
                    Confirmar Lançamento
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {showClosureConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClosureConfirm(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-zinc-900">Confirmar Fechamento</h3>
                  <button onClick={() => setShowClosureConfirm(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4 mb-8">
                  <p className="text-zinc-600">Deseja realizar o fechamento de caixa deste período?</p>
                  <div className="bg-zinc-50 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Total Recebido:</span>
                      <span className="font-bold text-emerald-600">R$ {totalWeeklyReceived.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Novas Dívidas:</span>
                      <span className="font-bold text-zinc-900">R$ {totalWeeklyDebts.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowClosureConfirm(false)}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleClosure}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {selectedClosure && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClosure(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-zinc-900">Detalhes do Fechamento</h3>
                    <p className="text-sm text-zinc-500">#{selectedClosure.id} • Fechado em {formatDate(selectedClosure.created_at, "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <button onClick={() => setSelectedClosure(null)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-50 p-4 rounded-2xl">
                    <p className="text-xs text-emerald-600 font-bold uppercase">Total Recebido</p>
                    <p className="text-2xl font-bold text-emerald-700 font-mono">R$ {selectedClosure.total_received.toFixed(2)}</p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-2xl">
                    <p className="text-xs text-zinc-400 font-bold uppercase">Novas Dívidas</p>
                    <p className="text-2xl font-bold text-zinc-900 font-mono">R$ {selectedClosure.total_debts.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <h4 className="font-bold text-zinc-900 mb-4">Transações do Período</h4>
                {loadingClosureDetails ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-medium">Carregando transações...</p>
                  </div>
                ) : closureTransactions.length === 0 ? (
                  <div className="py-20 text-center text-zinc-400">
                    Nenhuma transação encontrada para este fechamento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {closureTransactions.map(t => (
                      <div key={t.id} className="p-4 bg-zinc-50 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.amount < 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {t.amount < 0 ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 text-sm">{t.customer_name}</p>
                            <p className="text-xs text-zinc-500">{t.description || (t.amount < 0 ? 'Pagamento' : 'Dívida')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono font-bold ${t.amount < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            R$ {Math.abs(t.amount).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-zinc-400">{formatDate(t.date, "dd/MM HH:mm")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-zinc-100 bg-zinc-50">
                <button 
                  onClick={() => setSelectedClosure(null)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                >
                  Fechar Detalhes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
