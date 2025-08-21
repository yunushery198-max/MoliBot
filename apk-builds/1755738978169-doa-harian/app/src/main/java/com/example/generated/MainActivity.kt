package com.example.generated

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.style.TextAlign

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface {
                    Column(
                        modifier = androidx.compose.ui.Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(text = "Doa Harian", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
                        Spacer(modifier = androidx.compose.ui.Modifier.height(16.dp))
                        Text(text = "Aplikasi doa harian bergaya islami", style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
}