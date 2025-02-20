import {
    pgTable,
    uuid,
    vector,
    index,
    foreignKey,
    check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { numberTimestamp } from "./types";
import { memoryTable } from "./memory";

export const VECTOR_DIMS = {
    SMALL: 384,
    MEDIUM: 512,
    LARGE: 768,
    XL: 1024,
    XXL: 1536,
    XXXL: 3072,
} as const;

export const DIMENSION_MAP = {
    [VECTOR_DIMS.SMALL]: 'dim384',
    [VECTOR_DIMS.MEDIUM]: 'dim512',
    [VECTOR_DIMS.LARGE]: 'dim768',
    [VECTOR_DIMS.XL]: 'dim1024',
    [VECTOR_DIMS.XXL]: 'dim1536',
    [VECTOR_DIMS.XXXL]: 'dim3072',
} as const;

export const embeddingTable = pgTable(
    "embeddings",
    {
        id: uuid("id").primaryKey().defaultRandom().notNull(),
        memoryId: uuid("memory_id").references(() => memoryTable.id),
        createdAt: numberTimestamp("created_at")
            .default(sql`now()`)
            .notNull(),
        dim384: vector("dim_384", { dimensions: VECTOR_DIMS.SMALL }),
        dim512: vector("dim_512", { dimensions: VECTOR_DIMS.MEDIUM }),
        dim768: vector("dim_768", { dimensions: VECTOR_DIMS.LARGE }),
        dim1024: vector("dim_1024", { dimensions: VECTOR_DIMS.XL }),
        dim1536: vector("dim_1536", { dimensions: VECTOR_DIMS.XXL }),
        dim3072: vector("dim_3072", { dimensions: VECTOR_DIMS.XXXL }),
    },
    (table) => [
        check(
            "embedding_source_check",
            sql`"memory_id" IS NOT NULL`
        ),
        index("idx_embedding_memory").on(table.memoryId),
        foreignKey({
            name: "fk_embedding_memory",
            columns: [table.memoryId],
            foreignColumns: [memoryTable.id],
        }).onDelete("cascade"),
    ]
);

export type EmbeddingDimensionColumn = 'dim384' | 'dim512' | 'dim768' | 'dim1024' | 'dim1536' | 'dim3072';

export type EmbeddingTableColumn = typeof embeddingTable._.columns[EmbeddingDimensionColumn];
