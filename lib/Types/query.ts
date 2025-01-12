interface Relation {
  from: { schema: string; key: string };
  to: { schema: string; key: string };
  metadata: { type: string; onDelete: string; onUpdate: string };
}
export type Relations = Record<string, Relation>;

export interface Index {
  primary: Record<string, any>;
  inverted: Record<string, Record<any, number[]>>;
  schema?: Record<string, any>;
  validations?: Record<string, any>;
  fileRules?: Record<string, any>;
  relations?: Relations;
}

export type FilterOperator = {
    $eq?: any; 
    $neq?: any; 
    $gt?: number;  
    $gte?: number;
    $lt?: number; 
    $lte?: number; 
    $exists?: boolean;
    $not?: FilterOperator;  
    $in?: any[]; 
    $nin?: any[]; 
    $contains?: string | number;
    $containsAny?: (string | number)[];  
    $length?: number;  
    $startsWith?: string;  
    $endsWith?: string; 
    $replace?: [string | RegExp, string]; 
    $regex?: string | RegExp; 
    $and?: FilterCondition[];  
    $or?: FilterCondition[]; 
    $between?: [number | string, number | string]; 
    $date?: Date | string; 
    $add?: number;  
    $sub?: number; 
    $mul?: number;  
    $div?: number;  
    $mod?: number;
    $avg?: number;
    $sum?: number;
    $pow?: number;
    $sqrt?: number;
    $round?: number;
    $abs?: boolean; 
    $floor?: boolean;
    $ceil?: boolean;  
    [key: string]: any; 
  };
  
export type FilterCondition = {
    [field: string]: FilterOperator;
  };
  
  export interface QueryOptions {
    pipeline?: (string | Record<string, any>)[];
    filter?: FilterCondition;
    groupBy?: string;
    projection?: string[];
    sorting?: { fields: { field: string; order: 'asc' | 'desc' }[] };
    pagination?: { 
      skip?: number; 
      limit?: number; 
      page?: number; 
      pageSize?: number; 
    };
    textSearch?: { 
      query: string; 
      fields?: string[]; 
      exactMatch?: boolean; 
      fuzzy?: boolean; 
    };
    vectorSearch?: {
      queryVector?: number[];
      queryText?: string;
      vectorKeyPath: string;
      similarityThreshold?: number;
      metadataKeyPaths?: Record<string, string>;
      k?: number;
      sorting?: 'asc' | 'desc';
      method?: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming";
      projection?: any;
      data?: any[];
      pagination?: {
        pageSize?: number;
        offset?: number;
      };
      reduceDimensionality?: {
        method?: "pca" | "tsne";
      };
      targetDimension?: number;
      preprocessMethod?: 'normalize' | 'standardize' | 'robust';
    };
    customValidation?: (data: any[]) => boolean | string
    limit?: number;
  }
  