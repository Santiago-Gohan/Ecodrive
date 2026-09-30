package com.ecodrive.app

import android.Manifest
import android.app.AlertDialog
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")
    private val SERVIDOR_DEFECTO = "https://ecodrive-backend-r34q.onrender.com"

    private lateinit var txtEstado: TextView
    private lateinit var txtEct: TextView
    private lateinit var txtRpm: TextView
    private lateinit var txtLog: TextView
    private lateinit var inputServidor: EditText
    private lateinit var inputApikey: EditText
    private lateinit var inputIntervalo: EditText
    private lateinit var btnConectar: Button
    private lateinit var btnIniciar: Button
    private lateinit var btnDetener: Button

    private lateinit var db: EcoDb

    private var socket: BluetoothSocket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null
    private var hiloLectura: Thread? = null
    private var hiloEnvio: Thread? = null
    private var activo = false
    private var vehiculoId: String? = null
    private var vehiculoPlaca: String? = null

    private val ultimaEct = FloatArray(1) { -1f }
    private val ultimaRpm = FloatArray(1) { -1f }

    private val permisoBluetooth =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            if (it.values.all { v -> v }) conectarAdaptador() else mostrar("Permiso Bluetooth denegado")
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        db = EcoDb(this)

        txtEstado = findViewById(R.id.txtEstado)
        txtEct = findViewById(R.id.txtEct)
        txtRpm = findViewById(R.id.txtRpm)
        txtLog = findViewById(R.id.txtLog)
        inputServidor = findViewById(R.id.inputServidor)
        inputApikey = findViewById(R.id.inputApikey)
        inputIntervalo = findViewById(R.id.inputIntervalo)
        btnConectar = findViewById(R.id.btnConectar)
        btnIniciar = findViewById(R.id.btnIniciar)
        btnDetener = findViewById(R.id.btnDetener)

        inputServidor.setText(prefs("servidor", SERVIDOR_DEFECTO))
        inputApikey.setText(prefs("apikey", ""))
        inputIntervalo.setText(prefs("intervalo", "5"))
        val pendientes = db.contar()
        if (pendientes > 0) txtLog.text = "Hay $pendientes lectura(s) sin sincronizar."

        btnConectar.setOnClickListener { pedirPermisos() }
        btnIniciar.setOnClickListener { iniciarEnvio() }
        btnDetener.setOnClickListener { detenerEnvio() }
    }

    private fun pedirPermisos() {
        val requeridos = if (android.os.Build.VERSION.SDK_INT >= 31) {
            mutableListOf(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            mutableListOf(
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        }
        val faltantes = requeridos.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (faltantes.isEmpty()) conectarAdaptador()
        else permisoBluetooth.launch(faltantes.toTypedArray())
    }

    private fun conectarAdaptador() {
        val adaptador = BluetoothAdapter.getDefaultAdapter()
        if (adaptador == null) {
            mostrar("Este dispositivo no tiene Bluetooth")
            return
        }
        if (android.os.Build.VERSION.SDK_INT >= 31 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pedirPermisos()
            return
        }

        val pares = adaptador.bondedDevices.toList()
        if (pares.isEmpty()) {
            mostrar("No hay adaptadores emparejados. Vincúlalo en Ajustes > Bluetooth.")
            return
        }

        val nombres = pares.map { it.name ?: it.address }
        AlertDialog.Builder(this)
            .setTitle("Elegir adaptador OBD-II")
            .setItems(nombres.toTypedArray()) { _, i ->
                Thread { conectarSocket(pares[i]) }.start()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun conectarSocket(device: BluetoothDevice) {
        correrEnMain { txtEstado.text = "Conectando a ${device.name ?: device.address}..." }
        try {
            if (android.os.Build.VERSION.SDK_INT >= 31 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED
            ) {
                correrEnMain { mostrar("Sin permiso de Bluetooth") }
                return
            }
            val s = device.createRfcommSocketToServiceRecord(SPP_UUID)
            s.connect()
            socket = s
            input = s.inputStream
            output = s.outputStream
            inicializarElm()
            correrEnMain {
                txtEstado.text = "Conectado a ${device.name ?: device.address}"
                btnIniciar.isEnabled = true
                Log.d("EcoDrive", "Socket SPP abierto e inicializado")
            }
            hiloLectura = Thread { leerBufer() }.also { it.start() }
        } catch (e: Exception) {
            correrEnMain { mostrar("Error de conexión: ${e.message}") }
        }
    }

    // Secuencia de inicio ELM327 (los clones la necesitan para responder bien)
    private fun inicializarElm() {
        for (c in listOf("ATZ", "ATE0", "ATL0", "ATS0", "ATH0", "ATSP0")) {
            enviarComando(c)
            Thread.sleep(350)
        }
    }

    private fun leerBufer() {
        val entrada = input ?: return
        val bytes = ByteArray(256)
        val acumulado = StringBuilder()
        while (!Thread.currentThread().isInterrupted) {
            try {
                if (entrada.available() > 0) {
                    val n = entrada.read(bytes)
                    if (n > 0) {
                        acumulado.append(String(bytes, 0, n))
                        val texto = acumulado.toString()
                        if (texto.contains(">")) {
                            acumulado.clear()
                            procesarRespuesta(texto)
                        }
                    }
                } else {
                    Thread.sleep(50)
                }
            } catch (e: Exception) {
                socket = null
                correrEnMain {
                    detenerEnvio()
                    mostrar("Conexión perdida con el adaptador. Vuelve a conectar. (${e.message})")
                }
                break
            }
        }
    }

    private fun procesarRespuesta(dato: String) {
        if (dato.contains("4105")) {
            val hex = dato.substringAfter("4105").take(2)
            val ect = hex.toIntOrNull(16)?.minus(40) ?: return
            synchronized(ultimaEct) { ultimaEct[0] = ect.toFloat() }
            correrEnMain { txtEct.text = "ECT\n$ect °C" }
        }
        if (dato.contains("410C")) {
            val hex = dato.substringAfter("410C").take(4)
            val rpm = hex.toIntOrNull(16)?.div(4f) ?: return
            synchronized(ultimaRpm) { ultimaRpm[0] = rpm }
            correrEnMain { txtRpm.text = "RPM\n${rpm.toInt()}" }
        }
    }

    private fun lecturaPlausible(ect: Float, rpm: Float): Boolean =
        ect >= -40 && ect <= 150 && rpm >= 0 && rpm <= 9000

    private fun iniciarEnvio() {
        val segundos = (inputIntervalo.text.toString().toIntOrNull() ?: 5).coerceIn(1, 120)
        btnIniciar.isEnabled = false
        guardarPrefs("servidor", inputServidor.text.toString())
        guardarPrefs("apikey", inputApikey.text.toString())
        guardarPrefs("intervalo", segundos.toString())
        hiloEnvio = Thread {
            // 1) Resolver el vehiculo real con la API Key (antes era "-1" fijo -> 403)
            val id = consultarVehiculo()
            if (id == null) {
                correrEnMain {
                    mostrar("No se pudo identificar el vehículo. Revisa API Key y servidor.")
                    btnIniciar.isEnabled = true
                }
                return@Thread
            }
            vehiculoId = id.first
            vehiculoPlaca = id.second
            correrEnMain { txtEstado.text = "Monitoreando ${id.second} (cada $segundos s)" }
            activo = true
            correrEnMain { btnDetener.isEnabled = true }
            while (activo) {
                try {
                    Thread.sleep(segundos * 1000L)
                } catch (e: InterruptedException) {
                    break
                }
                if (!activo) break
                if (socket?.isConnected == true) {
                    enviarComando("0105")
                    Thread.sleep(300)
                    enviarComando("010C")
                    Thread.sleep(300)
                    val ect = synchronized(ultimaEct) { ultimaEct[0] }
                    val rpm = synchronized(ultimaRpm) { ultimaRpm[0] }
                    if (!lecturaPlausible(ect, rpm)) {
                        correrEnMain { mostrar("Lectura descartada (ECT=$ect RPM=$rpm). Revisa el adaptador.") }
                    } else {
                        enviarTelematica(ect.toInt(), rpm.toInt())
                    }
                }
            }
        }.also { it.start() }
    }

    private fun detenerEnvio() {
        activo = false
        hiloEnvio?.interrupt()
        btnIniciar.isEnabled = true
        btnDetener.isEnabled = false
        correrEnMain { mostrar("Envío detenido") }
    }

    private fun enviarComando(cmd: String) {
        val salida = output ?: return
        try {
            salida.write((cmd + "\r").toByteArray())
            salida.flush()
        } catch (e: Exception) {
            Log.e("EcoDrive", "Fallo enviando $cmd", e)
        }
    }

    // GET /telemetry/quien-soy con la API Key -> (id, placa) reales del vehiculo
    private fun consultarVehiculo(): Pair<String, String>? {
        return try {
            val servidor = prefs("servidor", SERVIDOR_DEFECTO).trimEnd('/')
            val apikey = prefs("apikey", "")
            val conn = (URL("$servidor/api/v1/telemetry/quien-soy").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("X-API-Key", apikey)
                connectTimeout = 8000
                readTimeout = 8000
            }
            if (conn.responseCode != 200) {
                conn.disconnect()
                return null
            }
            val texto = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            val j = JSONObject(texto)
            Pair(j.getString("id"), j.getString("placa"))
        } catch (e: Exception) {
            Log.e("EcoDrive", "quien-soy fallo", e)
            null
        }
    }

    private fun enviarTelematica(ect: Int, rpm: Int) {
        val vid = vehiculoId ?: return
        val ts = java.time.Instant.now().toString()
        val servidor = prefs("servidor", SERVIDOR_DEFECTO).trimEnd('/')
        val apikey = prefs("apikey", "")
        val body = JSONObject().apply {
            put("vehiculo_id", vid)
            put("ect", ect)
            put("rpm", rpm)
            put("timestamp", ts)
        }
        val ok = postJson("$servidor/api/v1/telemetry", apikey, body.toString())
        if (ok) {
            val res = sincronizarCola(servidor, apikey)
            correrEnMain {
                txtLog.text = "Enviado ECT=$ect°C RPM=$rpm" +
                    (if (res.first > 0) " (+${res.first} sincronizadas)" else "") +
                    (if (res.second > 0) " [${res.second} pendientes]" else "")
            }
        } else {
            db.guardar(vid, ect.toFloat(), rpm.toFloat(), ts)
            val n = db.contar()
            correrEnMain { txtLog.text = "Sin conexión. $n lectura(s) guardadas, se enviarán solas." }
        }
    }

    // Manda la cola offline en lotes de 200 a POST /telemetry/lote
    private fun sincronizarCola(servidor: String, apikey: String): Pair<Int, Int> {
        var enviadas = 0
        while (true) {
            val lote = db.tomarLote() ?: break
            val cuerpo = "{\"lecturas\":${lote.json}}"
            if (!postJson("$servidor/api/v1/telemetry/lote", apikey, cuerpo)) break
            db.borrarIds(lote.ids)
            enviadas += lote.ids.size
        }
        return Pair(enviadas, db.contar())
    }

    private fun postJson(urlStr: String, apikey: String, cuerpo: String): Boolean {
        return try {
            val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("X-API-Key", apikey)
                doOutput = true
                connectTimeout = 8000
                readTimeout = 15000
            }
            conn.outputStream.use { it.write(cuerpo.toByteArray()) }
            val codigo = conn.responseCode
            conn.disconnect()
            codigo in 200..299
        } catch (e: Exception) {
            Log.e("EcoDrive", "POST fallo: $urlStr", e)
            false
        }
    }

    private fun prefs(clave: String, def: String): String =
        getSharedPreferences("ecodrive", MODE_PRIVATE).getString(clave, def) ?: def

    private fun guardarPrefs(clave: String, valor: String) {
        getSharedPreferences("ecodrive", MODE_PRIVATE).edit().putString(clave, valor).apply()
    }

    private fun mostrar(mensaje: String) {
        txtLog.text = mensaje
        Log.d("EcoDrive", mensaje)
    }

    private fun correrEnMain(bloque: () -> Unit) {
        runOnUiThread(bloque)
    }
}
