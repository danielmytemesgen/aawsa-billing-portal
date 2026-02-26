// Compatibility shim: provide a minimal "supabase"-like API backed by Postgres
// This lets the rest of the codebase keep importing `supabase` while we
// incrementally convert queries to use parameterized SQL.

import { query } from './db';

type SupabaseResponse<T> = { data?: T; error?: any };

const table = (tableName: string) => ({
	select: (cols = '*') => ({
		eq: (col: string, val: any) => ({
			single: async (): Promise<SupabaseResponse<any>> => {
				const sql = `SELECT ${cols} FROM ${tableName} WHERE "${col}" = $1 LIMIT 1`;
				const rows = await query(sql, [val]);
				return { data: rows[0] ?? null };
			}
		}),
		then: async () => {
			const sql = `SELECT ${cols} FROM ${tableName}`;
			const rows = await query(sql);
			return { data: rows };
		}
	}),
	insert: (payload: any) => ({
		select: () => ({
			single: async (): Promise<SupabaseResponse<any>> => {
				const keys = Object.keys(payload);
				const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
				const sql = `INSERT INTO ${tableName} (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
				const rows: any = await query(sql, keys.map(k => payload[k]));
				return { data: rows[0] || payload };
			}
		})
	}),
	update: (payload: any) => ({
		eq: (col: string, val: any) => ({
			select: () => ({
				single: async (): Promise<SupabaseResponse<any>> => {
					const keys = Object.keys(payload);
					// $1..$N for payload, $N+1 for where clause
					const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
					const sql = `UPDATE ${tableName} SET ${setClause} WHERE "${col}" = $${keys.length + 1} RETURNING *`;
					const rows = await query(sql, [...keys.map(k => payload[k]), val]);
					return { data: rows[0] || payload };
				}
			})
		})
	}),
	delete: () => ({
		eq: (col: string, val: any) => ({
			then: async (): Promise<SupabaseResponse<any>> => {
				const sql = `DELETE FROM ${tableName} WHERE "${col}" = $1`;
				await query(sql, [val]);
				return { data: null };
			}
		})
	})
});

export const supabase = {
	from: (tableName: string) => table(tableName),
	rpc: async (fnName: string, params: any) => {
		// For now, map rpc to a simple function call or a NO-OP.
		try {
			if (fnName === 'insert_notification') {
				// Expecting params to be an object with fields matching notifications table
				const keys = Object.keys(params || {});
				const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
				const sql = `INSERT INTO notifications (${keys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders})`;
				await query(sql, keys.map(k => params[k]));
				return { data: null };
			}
			return { data: null };
		} catch (error) {
			return { error };
		}
	}
};
