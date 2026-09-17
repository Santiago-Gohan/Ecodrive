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

    private lateinit var txtEstado: TextView
    private lateinit var txtEct: TextView
    private lateinit var txtRpm: TextView
    private lateinit var txtLog: TextView
    private lateinit var inputServidor: EditText
    private lateinit var inputApikey: EditText
    private lateinit var btnConectar: Button
    private lateinit var btnIniciar: Button
    private lateinit var btnDetener: Button

    private var socket: BluetoothSocket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null
    private var hiloLectura: Thread? = null
    private var hiloEnvio: Thread? = null
    private var activo = false

    private val ultimaEct = FloatArray(1) { -1f }
    private val ultimaRpm = FloatArray(1) { -1f }

    private val permisoBluetooth =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            if (it.values.all { v -> v }) conectarAdaptador() else mostrar("Permiso Bluetooth denegado")
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        txtEstado = findViewById(R.id.txtEstado)
        txtEct = findViewById(R.id.txtEct)
        txtRpm = findViewById(R.id.txtRpm)
        txtLog = findViewById(R.id.txtLog)
        inputServidor = findViewById(R.id.inputServidor)
        inputApikey = findViewById(R.id.inputApikey)
        btnConectar = findViewById(R.id.btnConectar)
        btnIniciar = findViewById(R.id.btnIniciar)
        btnDetener = findViewById(R.id.btnDetener)

        inputServidor.setText(prefs("servidor", "http://192.168.X.X:3000"))
        inputApikey.setText(prefs("apikey", ""))

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
            correrEnMain {
                txtEstado.text = "Conectado a ${device.name ?: device.address}"
                btnIniciar.isEnabled = true
                Log.d("EcoDrive", "Socket SPP abierto")
            }
            hiloLectura = Thread { leerBufer() }.also { it.start() }
        } catch (e: Exception) {
            correrEnMain { mostrar("Error de conexión: ${e.message}") }
        }
    }

    private fun leerBufer() {
        val entrada = input ?: return
        val bytes = ByteArray(256)
        while (!Thread.currentThread().isInterrupted) {
            try {
                if (entrada.available() > 0) {
                    val n = entrada.read(bytes)
                    if (n > 0) {
                        val dato = String(bytes, 0, n)
                        procesarRespuesta(dato)
                    }
                }
            } catch (e: Exception) {
                correrEnMain { mostrar("Conexión perdida: ${e.message}") }
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

    private fun iniciarEnvio() {
        activo = true
        btnIniciar.isEnabled = false
        btnDetener.isEnabled = true
        guardarPrefs("servidor", inputServidor.text.toString())
        guardarPrefs("apikey", inputApikey.text.toString())
        hiloEnvio = Thread {
            while (activo) {
                Thread.sleep(5000)
                if (socket?.isConnected == true) {
                    enviarComando("0105")
                    Thread.sleep(200)
                    enviarComando("010C")
                    Thread.sleep(200)
                    val ect = synchronized(ultimaEct) { ultimaEct[0] }
                    if (ect > -1) enviarTelematica(ect.toInt(), synchronized(ultimaRpm) { ultimaRpm[0] }.toInt())
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

    private fun enviarTelematica(ect: Int, rpm: Int) {
        try {
            val servidor = prefs("servidor", "").trimEnd('/')
            val apikey = prefs("apikey", "")
            val body = JSONObject().apply {
                put("vehiculo_id", "-1")
                put("ect", ect)
                put("rpm", rpm)
                put("timestamp", java.time.Instant.now().toString())
            }
            val conn = (URL("$servidor/api/v1/telemetry").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("X-API-Key", apikey)
                doOutput = true
                connectTimeout = 5000
                readTimeout = 5000
            }
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val codigo = conn.responseCode
            conn.disconnect()
            if (codigo == 401) {
                correrEnMain { mostrar("API Key inválida (HTTP 401)") }
            } else {
                correrEnMain { txtLog.text = "Enviado ECT=$ect°C RPM=$rpm (HTTP $codigo)" }
            }
        } catch (e: Exception) {
            Log.e("EcoDrive", "No se pudo enviar telemetría", e)
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