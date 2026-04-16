// UI copy for the catalog CRUD. Kept in one file per CLAUDE.md §5.

export const catalogMessages = {
  page: {
    title: 'Catálogo',
    description: 'Productos, servicios y categorías compartidos entre ambas razones sociales.',
  },
  tabs: {
    items: 'Productos',
    categories: 'Categorías',
  },
  units: {
    pieza: 'Pieza',
    m2: 'Metro cuadrado (m²)',
    m: 'Metro lineal',
    litro: 'Litro',
    rollo: 'Rollo',
    hora: 'Hora',
  },
  pricingMode: {
    fixed: 'Precio fijo',
    variable: 'Precio variable (se captura en venta)',
  },
  items: {
    newButton: 'Nuevo producto',
    search: {
      placeholder: 'Buscar por nombre o descripción',
      ariaLabel: 'Buscar productos',
    },
    filters: {
      categoryAll: 'Todas las categorías',
      categoryLabel: 'Categoría',
      includeInactiveLabel: 'Mostrar inactivos',
    },
    list: {
      loading: 'Cargando productos…',
      loadError: 'No se pudieron cargar los productos.',
      empty: 'Aún no hay productos en el catálogo.',
      emptySearch: 'Sin resultados para los filtros aplicados.',
      resultCount: (shown: number, total: number) => `Mostrando ${shown} de ${total}`,
      pageOf: (current: number, total: number) => `Página ${current} de ${total}`,
      previous: 'Anterior',
      next: 'Siguiente',
    },
    columns: {
      name: 'Producto',
      category: 'Categoría',
      unit: 'Unidad',
      pricingMode: 'Modo',
      price: 'Precio',
      active: 'Activo',
      actions: 'Acciones',
    },
    form: {
      nameLabel: 'Nombre',
      namePlaceholder: 'Ej. Lona 13oz impresa',
      descriptionLabel: 'Descripción',
      descriptionPlaceholder: 'Detalles que ayuden a identificar el producto.',
      categoryLabel: 'Categoría',
      categoryPlaceholder: 'Selecciona una categoría',
      unitLabel: 'Unidad',
      pricingModeLabel: 'Modo de precio',
      priceLabel: 'Precio (MXN)',
      pricePlaceholder: '0.00',
      variableHint: 'El precio se captura al momento de la venta.',
      isActiveLabel: 'Activo',
      isActiveHint: 'Los productos inactivos no aparecen en POS.',
      save: 'Guardar',
      saving: 'Guardando…',
      cancel: 'Cancelar',
      errors: {
        nameRequired: 'El nombre es obligatorio.',
        categoryRequired: 'Selecciona una categoría.',
        priceInvalid: 'El precio debe ser un número mayor o igual a 0.',
      },
    },
    createDialog: {
      title: 'Nuevo producto',
      description: 'Agrega un producto o servicio al catálogo compartido.',
    },
    editDialog: {
      title: 'Editar producto',
      description: 'Actualiza los datos del producto.',
    },
    deleteDialog: {
      title: '¿Eliminar producto?',
      body: (name: string) =>
        `El producto "${name}" dejará de aparecer en las listas. Solo administración puede restaurarlo.`,
      confirm: 'Eliminar',
      cancel: 'Cancelar',
    },
    actions: {
      edit: 'Editar',
      delete: 'Eliminar',
      toggleActiveAria: (name: string) => `Alternar disponibilidad de ${name}`,
    },
    toast: {
      createSuccess: 'Producto creado.',
      updateSuccess: 'Producto actualizado.',
      activatedSuccess: 'Producto activado.',
      deactivatedSuccess: 'Producto desactivado.',
      deleteSuccess: 'Producto eliminado.',
      genericError: 'Ocurrió un problema. Intenta de nuevo.',
    },
  },
  categories: {
    newButton: 'Nueva categoría',
    list: {
      loading: 'Cargando categorías…',
      loadError: 'No se pudieron cargar las categorías.',
      empty: 'Aún no hay categorías.',
    },
    columns: {
      name: 'Nombre',
      status: 'Estado',
      actions: 'Acciones',
    },
    status: {
      active: 'Activa',
      inactive: 'Inactiva',
    },
    form: {
      nameLabel: 'Nombre',
      namePlaceholder: 'Ej. Lonas',
      isActiveLabel: 'Activa',
      isActiveHint: 'Las categorías inactivas no aparecen al crear productos.',
      save: 'Guardar',
      saving: 'Guardando…',
      cancel: 'Cancelar',
      errors: {
        nameRequired: 'El nombre es obligatorio.',
        nameTaken: 'Ya existe una categoría con ese nombre.',
      },
    },
    createDialog: {
      title: 'Nueva categoría',
      description: 'Las categorías agrupan productos en el catálogo.',
    },
    editDialog: {
      title: 'Editar categoría',
      description: 'Actualiza el nombre o el estado de la categoría.',
    },
    deleteDialog: {
      title: '¿Eliminar categoría?',
      body: (name: string) =>
        `La categoría "${name}" dejará de aparecer en las listas. Los productos que la usen seguirán existiendo, pero conviene reasignarlos.`,
      confirm: 'Eliminar',
      cancel: 'Cancelar',
    },
    actions: {
      edit: 'Editar',
      delete: 'Eliminar',
    },
    toast: {
      createSuccess: 'Categoría creada.',
      updateSuccess: 'Categoría actualizada.',
      deleteSuccess: 'Categoría eliminada.',
      genericError: 'Ocurrió un problema. Intenta de nuevo.',
    },
  },
} as const
