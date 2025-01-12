import Logger from "../Functions/loggers";
import { Index } from "../Types/query";
export interface VectorData {
    id: string;
    vector: number[];
    metadata?: Record<string, any>;
    data: any;
}
interface PaginationOptions {
    pageSize?: number;
    offset?: number;
}
interface SearchResult<T> {
    results: T[];
    total: number;
    hasMore: boolean;
    nextOffset?: number;
}
export default class nuv_vector<T extends VectorData> {
    logger: Logger;
    indexes: Index | null;
    constructor(indexes: Index | null);
    private embeddingCache;
    fetchEmbedding(text: string): Promise<number[]>;
    lazyLoadVectors(options?: PaginationOptions): AsyncGenerator<any>;
    private calculateCosineSimilarity;
    private calculateEuclideanDistance;
    private calculateManhattanDistance;
    private calculateMinkowskiDistance;
    private calculateHammingDistance;
    private calculatePearsonCorrelation;
    private calculateJaccardSimilarity;
    query(input: {
        queryVector?: number[];
        queryText?: string;
        vectorKeyPath: string;
        similarityThreshold?: number;
        metadataKeyPaths?: Record<string, string>;
        k?: number;
        radius?: number;
        sorting?: 'asc' | 'desc';
        method?: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming";
        projection?: (keyof T)[];
        data?: any[];
        pagination?: PaginationOptions;
        reduceDimensionality?: {
            method?: "pca" | "tsne";
        };
        targetDimension?: number;
        preprocessMethod?: 'normalize' | 'standardize' | 'robust';
    }): Promise<any[]>;
    findNearestNeighbors(queryVector: number[], k: number | undefined, method: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming" | undefined, vectorKeyPath: string, sorting?: 'asc' | 'desc', radius?: number, projection?: (keyof T)[], metadataKeyPaths?: Record<string, string>, data?: any[], pagination?: PaginationOptions): Promise<SearchResult<any>>;
    fetchMetadata(item: any, metadataKeyPaths: Record<string, string>): Promise<Record<string, any>>;
    private preprocessVector;
    private normalizeVector;
    private standardizeVector;
    private robustPreprocessVector;
    private median;
    private iqr;
    clusterVectors(k: number, iterations?: number, method?: "kmeans++" | "random", distanceMetric?: "euclidean" | "cosine" | "manhattan", preprocessMethod?: "normalize" | "standardize" | "robust"): {
        centroids: number[][];
        clusters: Map<number, T[]>;
    };
    private initializeCentroidsKMeansPlusPlus;
    private recalculateCentroids;
    private checkConvergence;
    private weightedRandomChoice;
    private calculateDistance;
    reduceDimensionality(vectors: number[][], method?: 'pca' | 'tsne' | 'umap', targetDimension?: number, options?: {
        [key: string]: any;
    }): {
        reducedVectors: number[][];
        explainedVariance?: number[];
        reconstructedMatrix?: number[][];
        finalCost?: number;
    };
    private reduceUsingPCA;
    private reduceUsingTSNE;
    private reduceUsingUMAP;
    detectOutliers(options: {
        method?: "zscore" | "iqr" | "lof" | "isolationForest" | "oneClassSVM";
        threshold?: number;
        contamination?: number;
        k?: number;
    }): T[];
    private detectOutliersZScore;
    private detectOutliersIQR;
    private detectOutliersIsolationForest;
    private detectOutliersLOF;
    private detectOutliersOneClassSVM;
    private quantile;
    ensembleVectorQuery(queries: {
        queryVector: number[];
        method?: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming";
        weight?: number;
        k?: number;
        vectorKeyPath?: string;
        sorting?: "asc" | "desc";
        radius?: number;
        reduceDimensionality?: {
            method?: "pca" | "tsne" | "umap";
            targetDimension?: number;
            options?: {
                [key: string]: any;
            };
        };
        preprocessMethod?: "normalize" | "standardize" | "robust";
        projection?: (keyof T)[];
        metadataKeyPaths?: Record<string, string>;
        pagination?: PaginationOptions;
    }[]): Promise<any[]>;
}
export {};
//# sourceMappingURL=vectors.d.ts.map