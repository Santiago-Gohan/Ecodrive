package com.ecodrive.app

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

// Buffer offline: hasta 5000 lecturas (~7 h a 1/5 s) para zonas sin cobertura.
class EcoDb(ctx: Context) : SQLiteOpenHelper(ctx, "ecodrive.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE lecturas(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehiculo_id TEXT NOT NULL,
                ect REAL NOT NULL,
                rpm REAL NOT NULL,
                ts TEXT NOT NULL
            )"""
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, old: Int, nuevo: Int) {}

    fun guardar(vehiculoId: String, ect: Float, rpm: Float, ts: String) {
        val db = writableDatabase
        val v = ContentValues().apply {
            put("vehiculo_id", vehiculoId)
            put("ect", ect)
            put("rpm", rpm)
            put("ts", ts)
        }
        db.insert("lecturas", null, v)
        // Tope 5000: borra las mas antiguas
        db.execSQL(
            "DELETE FROM lecturas WHERE id NOT IN " +
                "(SELECT id FROM lecturas ORDER BY id DESC LIMIT 5000)"
        )
        db.close()
    }

    fun contar(): Int {
        val db = readableDatabase
        val c = db.rawQuery("SELECT COUNT(*) FROM lecturas", null)
        val n = if (c.moveToFirst()) c.getInt(0) else 0
        c.close(); db.close()
        return n
    }

    data class Lote(val ids: List<Long>, val json: String)

    // Saca hasta 200 lecturas mas antiguas en formato JSON para POST /lote
    fun tomarLote(max: Int = 200): Lote? {
        val db = readableDatabase
        val c = db.rawQuery(
            "SELECT id, vehiculo_id, ect, rpm, ts FROM lecturas ORDER BY id ASC LIMIT $max", null
        )
        val ids = mutableListOf<Long>()
        val sb = StringBuilder("[")
        var primero = true
        while (c.moveToNext()) {
            ids.add(c.getLong(0))
            if (!primero) sb.append(",")
            primero = false
            sb.append(
                """{"vehiculo_id":"${c.getString(1)}","ect":${c.getFloat(2)},"rpm":${c.getFloat(3)},"timestamp":"${c.getString(4)}"}"""
            )
        }
        c.close(); db.close()
        if (ids.isEmpty()) return null
        sb.append("]")
        return Lote(ids, sb.toString())
    }

    fun borrarIds(ids: List<Long>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        db.execSQL("DELETE FROM lecturas WHERE id IN (${ids.joinToString(",")})")
        db.close()
    }
}
