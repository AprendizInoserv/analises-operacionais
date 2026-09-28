import * as React from 'react';
import { ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { cn, normalizeString } from '@/lib/utils';

/**
 * Interface dos objetos de opções do select.
 */
interface Option {
  value: string;
  label: string;
}

/**
 * Props aceitas pelo componente SearchableSelect.
 */
interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  multiple?: boolean;
  loading?: boolean;
  onSearchChange?: (value: string) => void;
  disabled?: boolean;
}

/**
 * Componente Dropdown de Seleção Pesquisável (SearchableSelect).
 * 
 * Por que existe: Fornece uma alternativa premium e intuitiva ao select nativo 
 * do navegador (combobox). Permite carregar listas extensas de opções (como lojas 
 * ou coordenadores) e filtrar itens em tempo real através de um campo de digitação, 
 * facilitando a usabilidade em planilhas e auditorias.
 * 
 * Suporta multiseleção por checkboxes quando `multiple` é definido como true.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Pesquisar...",
  emptyMessage = "Nenhum resultado encontrado.",
  className,
  multiple = false,
  loading = false,
  onSearchChange,
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Fecha o dropdown se o usuário clicar fora do componente
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtra as opções com base no texto digitado (ignora acentos)
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const normalizedSearch = normalizeString(search);
    return options.filter(opt => 
      normalizeString(opt.label).includes(normalizedSearch) || 
      normalizeString(opt.value).includes(normalizedSearch)
    );
  }, [options, search]);

  // Valores selecionados como lista (para multiseleção)
  const selectedValues = React.useMemo(() => {
    if (!multiple) return [];
    if (!value) return [];
    return value.split(',').filter(Boolean);
  }, [value, multiple]);

  /**
   * Obtém todas as opções de valor que não são vazias (excluindo a opção "Todos").
   * Existe para sabermos exatamente quais opções podem ser selecionadas individualmente.
   */
  const allSelectableValues = React.useMemo(() => {
    return options.filter(opt => opt.value !== "").map(opt => opt.value);
  }, [options]);

  /**
   * Verifica se todas as opções válidas estão selecionadas.
   * Existe para controlar o estado visual do checkbox do botão "Selecionar Todos"
   * e decidir se o próximo clique irá selecionar tudo ou limpar a seleção.
   */
  const areAllSelected = React.useMemo(() => {
    if (allSelectableValues.length === 0) return false;
    return allSelectableValues.every(val => selectedValues.includes(val));
  }, [allSelectableValues, selectedValues]);

  // Encontra a opção ou opções atualmente selecionadas para exibir no botão gatilho
  const triggerText = React.useMemo(() => {
    if (multiple) {
      // Se nenhuma opção estiver selecionada ou se todas estiverem selecionadas,
      // mostra o texto da opção padrão (ex: "Todas as Lojas" ou "Todos")
      if (selectedValues.length === 0 || areAllSelected) {
        const defaultOpt = options.find(opt => opt.value === "");
        return defaultOpt ? defaultOpt.label : placeholder;
      }
      const selectedLabels = selectedValues
        .map(val => {
          const opt = options.find(o => o.value === val);
          if (val === "null" || (opt && opt.label === "null")) return "(Vazio)";
          return opt ? opt.label : val;
        })
        .filter(Boolean);
      
      if (selectedLabels.length <= 2) {
        return selectedLabels.join(', ');
      }
      return `${selectedLabels.length} selecionados`;
    } else {
      const selectedOption = options.find(opt => opt.value === value);
      if (selectedOption) {
        return selectedOption.value === "null" || selectedOption.label === "null" ? "(Vazio)" : selectedOption.label;
      }
      return placeholder;
    }
  }, [options, value, selectedValues, multiple, placeholder, areAllSelected]);

  /**
   * Gerencia a seleção e a multiseleção dos itens.
   * Se for multiseleção, ao clicar na opção padrão (valor vazio, representando "Todos"),
   * o componente agora seleciona explicitamente todas as opções válidas ao invés de limpar,
   * permitindo ao usuário desmarcar individualmente o que ele não precisa.
   */
  const handleSelect = (val: string) => {
    if (multiple) {
      let nextList: string[];
      if (val === "") {
        // Clicar na opção "Todos" (valor "")
        if (areAllSelected && selectedValues.length > 0) {
          // Se todas as opções já estão marcadas, o clique limpa todas as seleções
          nextList = [];
        } else {
          // Se não estavam todas marcadas, o clique marca todas
          nextList = allSelectableValues;
        }
      } else {
        if (selectedValues.includes(val)) {
          nextList = selectedValues.filter(v => v !== val);
        } else {
          nextList = [...selectedValues, val];
        }
      }
      onChange(nextList.join(','));
    } else {
      onChange(val);
      setIsOpen(false);
      setSearch("");
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Botão de Gatilho (Trigger) */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 cursor-pointer shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 select-none min-h-[38px] transition-colors",
          disabled && "opacity-50 pointer-events-none cursor-not-allowed"
        )}
      >
        <span className={cn("truncate", !value && !multiple && "text-neutral-400")}>
          {triggerText}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-455" />
      </div>

      {/* Painel Flutuante (Popover) */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-full z-50 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md p-2 flex flex-col gap-1.5 max-h-60">
          {/* Caixa de Entrada de Pesquisa */}
          <div className="relative">
            {loading ? (
              <Loader2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400 animate-spin" />
            ) : (
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (onSearchChange) onSearchChange(val);
              }}
              placeholder={searchPlaceholder}
              className="w-full input-with-icon-left-sm pr-2.5 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-md bg-neutral-50 dark:bg-neutral-950 text-xs focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:outline-none"
              onClick={(e) => e.stopPropagation()} // Impede o fechamento do painel ao clicar no input
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
            />
            {search && (
              <button
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setSearch(""); 
                  if (onSearchChange) onSearchChange("");
                }}
                className="absolute right-2 top-2 p-0.5 rounded text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-850 cursor-pointer transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Banner de Atualização Reativa */}
          {loading && (
            <div className="text-[10px] text-neutral-400 text-center py-1 bg-neutral-50 dark:bg-neutral-950 rounded-md animate-pulse">
              Atualizando opções...
            </div>
          )}

          {/* Lista de Opções Filtradas */}
          <div className="flex-1 overflow-y-auto space-y-0.5 max-h-40 min-h-[50px] pr-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2.5 py-3 text-xs text-neutral-400 text-center">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                // Para multiseleção, a opção "Todos" (valor "") fica marcada se nenhuma opção estiver
                // selecionada (filtro padrão de tudo) OU se todas as opções estiverem selecionadas explicitamente.
                // As outras opções individuais ficam marcadas se estiverem contidas na lista de selecionadas.
                const isSelected = multiple
                  ? (opt.value === "" 
                      ? (selectedValues.length === 0 || areAllSelected) 
                      : selectedValues.includes(opt.value))
                  : opt.value === value;

                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors select-none text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white",
                      isSelected && !multiple && "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold",
                      isSelected && multiple && "bg-neutral-50 dark:bg-neutral-850 font-semibold"
                    )}
                  >
                    {multiple && (
                      <div className={cn(
                        "w-3.5 h-3.5 border rounded flex items-center justify-center transition-colors shrink-0",
                        isSelected 
                          ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900" 
                          : "border-neutral-300 dark:border-neutral-750"
                      )}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                    <span className="truncate">{opt.label === "null" || opt.value === "null" ? "(Vazio)" : opt.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
